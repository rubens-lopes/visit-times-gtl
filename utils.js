const fs = require('fs')
const { resultFolder } = require('./params')

const deg2rad = a => a * Math.PI / 180

module.exports = {
    createResultFolder: () => {
        const timerLabel = `creates '${resultFolder}' folder`
        console.time(timerLabel)

        fs.exists(`./${resultFolder}/`, exists => {
            if (!exists)
                fs.mkdir(`./${resultFolder}/`, () => console.timeEnd(timerLabel))
            else
                console.timeEnd(timerLabel)
        })
    },
    distBwPoints: (p1, p2) => {
        // Using https://en.wikipedia.org/wiki/Haversine_formula
        const phi1 = deg2rad(p1.x)
        const lba1 = deg2rad(p1.y)
        const phi2 = deg2rad(p2.x)
        const lba2 = deg2rad(p2.y)

        const r = 6371 * 1e3 // Earth's radius: 6371kms in meters
        return 2 * r * Math.asin(Math.sqrt(Math.sin((phi2 - phi1) / 2) ** 2
            + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lba2 - lba1) / 2) ** 2))
    },
    num2roundedStr: num => `00${num}`.substr(-2)
}
