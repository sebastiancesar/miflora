'use strict';

const config = {
    UUID_SERVICE_XIAOMI: 'fe95',
    UUID_SERVICE_DATA: '0000120400001000800000805f9b34fb',
    UUID_CHARACTERISTIC_MODE: '00001a0000001000800000805f9b34fb',
    UUID_CHARACTERISTIC_DATA: '00001a0100001000800000805f9b34fb',
    UUID_CHARACTERISTIC_FIRMWARE: '00001a0200001000800000805f9b34fb',
    UUID_HISTORICAL_DATA: '00001a1100001000800000805f9b34fb',
    UUID_CHARACTERISTICS_HISTORY_MODE: '00001a1000001000800000805f9b34fb',
    UUID_SERIVCE_HISTORY_DATA: '0000120600001000800000805f9b34fb',
    UUID_CHARACTERISTIC_TIME: '00001a1200001000800000805f9b34fb',
    
    MODE_BUFFER_SERIAL: Buffer.from('b0ff', 'hex'),
    DATA_MODE: {
        history: {
            enable: Buffer.from('a00000', 'hex'),
            disable: Buffer.from('c00000', 'hex')
        },
        realtime: {
            enable: Buffer.from('a01f', 'hex'),
            disable: Buffer.from('c01f', 'hex')
        }
    },
    CLEAR_HISTORY_BUFFER: Buffer.from('a20000', 'hex'),
    HISTORY_BASE_ADDRESS: 'a1'
}

module.exports = config;
