'use strict';

const timeout = (timeout, promiseFuncs) => {
	const promises = [new Promise(promiseFuncs)];
	if (timeout > 0) {
		promises.push(
			new Promise((resolve, reject) => {
				setTimeout(() => {
					return reject(new Error('timeout'));
				}, timeout);
			})
		);
	}
	return Promise.race(promises);
};

module.exports = timeout;
