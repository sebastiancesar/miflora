'use strict';
const timeout = require('./timeout');
const bleParams = require('./miflora-ble');
const MiFloraHistory = require('./miflora-history');
const debug = require('debug');

/**
 * Represents a Mi Flora device
 * @public
 */
class MiFloraDevice {
	/**
	 * @private
	 * @param {Peripheral} peripheral
	 */
	constructor(peripheral, type) {
		this._history = new MiFloraHistory(this);
		this._peripheral = peripheral;
		this._service = undefined;
		this._serviceHistory = undefined;
		this._firmwareCharacteristic = undefined;
		this._modeCharacteristic = undefined;
		this._dataCharacteristic = undefined;
		this.name = peripheral.advertisement.localName;
		this.address = MiFloraDevice.normaliseAddress(peripheral.address);
		this.lastDiscovery = new Date().getTime();
		this.isConnected = false;
		this.type = type ? type : 'unknown';
		this.responseTemplate = {
			address: this.address,
			type: this.type
		};
		this.logDebug = debug('miflora:device:' + this.address);
		peripheral.on('connect', error => {
			if (error) {
				this.logDebug('error while connecting to device: %s', error);
			} else {
				this.logDebug('connected to device');
				this.isConnected = true;
			}
		});
		peripheral.on('disconnect', error => {
			if (error) {
				this.logDebug('error while disconnecting: %s', error);
			} else {
				this.logDebug('disconnected from device');
				this.isConnected = false;
			}
		});
	}

	/**
	 * Connects to the device
	 * @public
	 * @returns {Promise} Promise for connection process
	 */
	connect() {
		return timeout(10000, (resolve, reject) => {
			if (this._peripheral.state === 'connected') {
				return resolve();
			}
			this._peripheral.once('connect', async () => {
				try {
					await this._resolveCharacteristics();
					return resolve();
				} catch (error) {
					return reject(error);
				}
			});
			this.logDebug('initiating connection');
			this._peripheral.connect();
		});
	}

	/**
	 * Disconnects from the device
	 * @public
	 * @returns {Promise} Promise for disconnection process
	 */
	disconnect() {
		return timeout(10000, (resolve, reject) => {
			if (this._peripheral.state === 'disconnected') {
				return resolve();
			}
			this._peripheral.once('disconnect', async () => {
				try {
					return resolve();
				} catch (error) {
					return reject(error);
				}
			});
			this.logDebug('closing connection');
			this._peripheral.disconnect();
		});
	}

	queryFirmwareInfo(plain = false) {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('querying firmware information');
			try {
				await this.connect();
				const data = await this._readCharacteristic(this._firmwareCharacteristic);
				const response = this.responseTemplate;
				response.firmwareInfo = {
					battery: data.readUInt8(0),
					firmware: data.toString('ascii', 2, data.length)
				};
				this.logDebug('successfully queried firmware information: %o', response.firmwareInfo);
				resolve(plain ? response.firmwareInfo : response);
			} catch (err) {
				reject(err);
			}
		});
	}

	queryHistory() {
		return this._history.queryHistory();
	}

	clearHistory() {
		return this._history.clearHistory();
	}

	querySensorValues(plain = false) {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('querying sensor values');
			try {
				await this.connect();
				await this._setRealtimeDataMode(true);
				const data = await this._readCharacteristic(this._dataCharacteristic);
				const response = this.responseTemplate;
				response.sensorValues = {
					temperature: data.readUInt16LE(0) / 10,
					lux: data.readUInt32LE(3),
					moisture: data.readUInt8(7),
					fertility: data.readUInt16LE(8)
				};
				this.logDebug('successfully queried sensor values: %o', response.sensorValues);
				return resolve(plain ? response.sensorValues : response);
			} catch (error) {
				return reject(error);
			}
		});
	}

	querySerial(plain = false) {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('querying serial number');
			try {
				await this.connect();
				await this._setDeviceMode(bleParams.MODE_BUFFER_SERIAL);
				const data = await this._readCharacteristic(this._dataCharacteristic);
				const response = this.responseTemplate;
				response.serial = data.toString('hex');
				this.logDebug('successfully queried serial: %s', response.serial);
				return resolve(plain ? response.serial : response);
			} catch (error) {
				return reject(error);
			}
		});
	}

	query() {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('querying multiple information');
			try {
				const result = this.responseTemplate;
				result.firmwareInfo = await this.queryFirmwareInfo(true);
				result.sensorValues = await this.querySensorValues(true);
				this.logDebug('successfully queried multiple information');
				return resolve(result);
			} catch (error) {
				return reject(error);
			}
		});
	}

	/**
	 * @private
	 * @param {ByteBuffer} buffer Bytes to write
	 */
	_setDeviceMode(buffer, modeCharacteristic) {
		return timeout(10000, async (resolve, reject) => {
			try {
				this.logDebug('changing device mode');
				await this._writeCharacteristic(modeCharacteristic, buffer);
				const data = await this._readCharacteristic(modeCharacteristic);
				if (data.equals(buffer)) {
					this.logDebug('successfully changed device mode');
					return resolve(data);
				}
				return reject(new Error('failed to change mode'));
			} catch (err) {
				return reject(err);
			}
		});
	}

	_setRealtimeDataMode(enable) {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('%s realtime data mode', (enable ? 'enabling' : 'disabling'));
			const buffer = enable ? bleParams.DATA_MODE.realtime.enable : bleParams.DATA_MODE.realtime.disable;
			try {
				return resolve(await this._setDeviceMode(buffer, this._modeCharacteristic));
			} catch (err) {
				return reject(err);
			}
		});
	}
	
	
	_resolveCharacteristics() {
		return timeout(10004, async (resolve, reject) => {
			try {
				this.logDebug('resolving characteristic');
				this._peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
					if (error) {
						return reject(error);
					}
					this.logDebug('successfully resolved characteristics (%d/%d)', services.length, characteristics.length);
					this._service = this._peripheral.services
						.find(entry => entry.uuid === bleParams.UUID_SERVICE_DATA);
					
					this._firmwareCharacteristic = this._service.characteristics
						.find(entry => entry.uuid === bleParams.UUID_CHARACTERISTIC_FIRMWARE);
					
					this._modeCharacteristic = this._service.characteristics
						.find(entry => entry.uuid === bleParams.UUID_CHARACTERISTIC_MODE);
					this._dataCharacteristic = this._service.characteristics
						.find(entry => entry.uuid === bleParams.UUID_CHARACTERISTIC_DATA);
					
					this._history._resolveCharacteristics(services, characteristics);
					return resolve();
				});
			} catch (error) {
				return reject(error);
			}
		});
	}

	/**
	 * @private
	 */
	_readCharacteristic(characteristic) {
		return timeout(10000, async (resolve, reject) => {
			try {
				characteristic.read((error, data) => {
					if (error) {
						return reject(error);
					}
					this.logDebug('successfully read value \'0x%s\' from characteristic %s', data.toString('hex').toUpperCase(), characteristic.uuid.toUpperCase());
					return resolve(data);
				});
			} catch (error) {
				return reject(error);
			}
		});
	}

	/**
	 * @private
	 */
	_writeCharacteristic(characteristic, data) {
		return timeout(10000, async (resolve, reject) => {
			try {
				characteristic.write(data, false, error => {
					if (error) {
						return reject(error);
					}
					this.logDebug('successfully wrote value \'0x%s\' to characteristic %s', data.toString('hex').toUpperCase(), characteristic.uuid.toUpperCase());
					return resolve();
				});
			} catch (error) {
				return reject(error);
			}
		});
	}

	/**
     * Factory method to create an instance from given Peripheral.
     * @private
     * @static
     * @param {Peripheral} peripheral
     */
	static from(peripheral) {
		if (peripheral && peripheral.advertisement && peripheral.advertisement.serviceData) {
			const dataItem = peripheral.advertisement.serviceData.find(item => item.uuid === bleParams.UUID_SERVICE_XIAOMI);
			if (dataItem) {
				const productId = dataItem.data.readUInt16LE(2);
				switch (productId) {
					case 152:
						return new MiFloraDevice(peripheral, 'MiFloraMonitor');
					case 349:
						return new MiFloraDevice(peripheral, 'MiFloraPot');
					default:
				}
			}
		}
	}

	static normaliseAddress(address) {
		return address.replace(/-/g, ':').toLowerCase();
	}

}

module.exports = MiFloraDevice;
