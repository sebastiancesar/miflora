# miflora

Node.js package for the Xiaomi Mi Flora Plant Sensor built on top of [noble](https://github.com/noble/noble).

Have a look in the [Wiki](https://github.com/ChrisScheffler/miflora/wiki) for more information on the sensor.

This repo is forked from this excellent work https://github.com/ChrisScheffler/miflora

I added the feature to retrieve the historical records saved on the device.

I tried not to mess too much with the existing code, so I added all the new logic into a separate class, maybe is not the best approach but at least is easy to read.

---


### Historical records
The device stores historical data when not connected that can be later synchronized.

```javascript
const history = await device.queryHistory();
```
It will return all the record present in the memory of the device. This records has the same shape like the real time values, but with a timestamp.

Also is possible to clear that memory:

```javascript
const history = await device.clearHistory();
```

The logic for retrieving the history is explained here https://github.com/vrachieru/xiaomi-flower-care-api#historical-data
