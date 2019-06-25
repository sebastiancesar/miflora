'use strict';

const timeout = require('./timeout');
const bleParams = require('./miflora-ble');
const debug = require('debug');

/**
 * Translated what it says here https://github.com/vrachieru/xiaomi-flower-care-api#historical-data
 * to nodejs. 
 * The device save one measurment every hour and with queryHistory() you can get
 * those records.
 * 
 * Tested with a generic version of the xiaomi.
 */
class MiFloraHistory {
    
    constructor(miFloraDevice) {
        this.device = miFloraDevice;
        this.logDebug = debug('miflora-history:device:' + this.device.address);
    }
    
    _resolveCharacteristics(services) {
        this._serviceHistory = services.find(entry => 
            entry.uuid === bleParams.UUID_SERIVCE_HISTORY_DATA);
        this._deviceTimeCharacteristic = this._serviceHistory.characteristics
            .find(entry => entry.uuid === bleParams.UUID_CHARACTERISTIC_TIME);
        this._modeCharacteristicHistory = this._serviceHistory.characteristics
            .find(entry => entry.uuid === bleParams.UUID_CHARACTERISTICS_HISTORY_MODE);
        this._historyCharacteristic = this._serviceHistory.characteristics
            .find(entry => entry.uuid === bleParams.UUID_HISTORICAL_DATA);
    }
    
    _readDeviceTime() {
        return timeout(10000, async (resolve, reject) => {
            try {
                this.logDebug('querying Time device');
                await this.device.connect();
                const data = await this.device._readCharacteristic(this._deviceTimeCharacteristic);
                const epoch = data.readUInt32LE(0);
                this.logDebug('epoch from device ', epoch);
                resolve(epoch);
            } catch (err) {
                reject(err);
            }
        });
    }

    async queryTime() {
        const start = Date.now();
        const wallTime = (Date.now() + start) / 2;
        const epochOffset = await this._readDeviceTime();
        const epochTime = wallTime - epochOffset;
        this.logDebug('wall time: ', epochTime);
        return epochTime;
    }

    _amountOfRecords() {
        return timeout(10000, async (resolve, reject) => {
            try {
                const data = await this.device._readCharacteristic(this._historyCharacteristic);
                const historyRecords = data.readUInt16LE(0);
                this.logDebug('successfully queried Historical amount of records: %o', historyRecords);
                return resolve(historyRecords);
            } catch (err) {
                reject(err);
            }
        });
    }

    _getHistoryAddressForPosition(index) {
        const address = bleParams.HISTORY_BASE_ADDRESS + 
            this._toPaddedHexString(index, 2) + '00';
        const addressHex = Buffer.from(address, 'hex');
        return addressHex;
    }

    _parseHistoryRecord(historyRecord, epochTime) {
        let response = {
            timestamp: historyRecord.readUInt32LE(0),
            temperature: historyRecord.readUInt16LE(4) / 10,
            lux: historyRecord.readUInt32LE(7),
            moisture: historyRecord.readUInt8(11),
            fertility: historyRecord.readUInt16LE(12)
        }
        response.date = new Date(response.timestamp + epochTime);
        return response;
    }

    queryHistory() {
        return timeout(10000, async (resolve, reject) => {
            this.logDebug('querying history sensor values');
            try {
                await this.device.connect();
                await this._setHistoryDataMode(true);
                const epochTime = await this.queryTime();
                const historyRecords = this._amountOfRecords();
                let results = [];
                for (let i = 0; i < historyRecords; i++) {
                    const addressHex = this._getHistoryAddressForPosition(i);
                    await this.device._writeCharacteristic(this._modeCharacteristicHistory, addressHex);
                    const historyRecord = await this.device._readCharacteristic(this._historyCharacteristic);
                    const response = this._parseHistoryRecord(historyRecord, epochTime);
                    results.push(response);
                }
                return resolve(results);
            } catch (error) {
                return reject(error);
            }
        });
    }

    _toPaddedHexString(num, len) {
        let str = Number(num).toString(16);
        return '0'.repeat(len - str.length) + str;
    }

    _setHistoryDataMode(enable) {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('%s history data mode', (enable ? 'enabling' : 'disabling'));
			const buffer = enable ? bleParams.DATA_MODE.history.enable : bleParams.DATA_MODE.history.disable;
			try {
				return resolve(await this.device._setDeviceMode(buffer, this._modeCharacteristicHistory));
			} catch (err) {
				return reject(err);
			}
		});
	}
    
    clearHistory() {
		return timeout(10000, async (resolve, reject) => {
			this.logDebug('erasing history');
			try {
                await this._setHistoryDataMode(true);
                return resolve(await this.device._writeCharacteristic(
                    this._modeCharacteristicHistory,
                    bleParams.CLEAR_HISTORY_BUFFER));
			} catch (err) {
				return reject(err);
			}
		});
	}
}

module.exports = MiFloraHistory;