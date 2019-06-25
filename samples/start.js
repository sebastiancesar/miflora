'use strict';

const miflora = require('../lib/miflora');

class Main {

    constructor() {
        this.device = null;
    }

    discover() {
        return miflora.discover()
            .then((devices) => {
                if (devices.length > 0) {
                    this.device = devices[0];
                }
            });
    }

    showHistory() {
        return this.device.queryHistory()
            .then((data) => {
                console.log(data);
            });
    }

    showData() {
        return this.device.querySensorValues()
            .then((data) => {
                console.log(data);
                this.showData();
            });
    }

    clearHistory() {
        return this.device.clearHistory();
    }

    init() {
        this.discover()
            .then(()=> {
                if (!this.device) {
                    return this.discover();
                }
            })
            .then(() => {
                return this.device.connect();
            })
            .then(() => {
                return this.showHistory();
                // return this.clearHistory();
            });
      
    }
}

new Main().init();
