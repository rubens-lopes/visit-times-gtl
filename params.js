const moment = require('moment')

module.exports = {
    jsonFile: 'timeline.min',
    resultFolder: 'results',
    resultFileName: moment().toISOString().replace(/\:/g, ''),

    from: null,//+moment('2019-10-01 00:00:00'),
    to: null,//+moment('2019-10-01 23:59:59'),

    maxDist: 100,
    maxDeltaTime: moment.duration(15, 'minutes').asMilliseconds(),

    pointOfInterest: { x: -20.480556, y: -54.604861 }
}
