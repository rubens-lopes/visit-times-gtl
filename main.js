const JSONStream = require('JSONStream')
const es = require('event-stream')
const fs = require('fs')
const moment = require('moment')

const fileStream = fs.createReadStream(
  './timeline.json',
  { encoding: 'utf8' }
)

const from = +moment('2019-09-02 00:00:00')
const to = +moment('2019-09-02 23:59:59')
const point = {
  x: -20.481060,
  y: -54.606517,
}
const maxDist = 100

const points = []

const deg2rad = a => a * Math.PI / 180

const dist2points = (p1, p2) => {
  // Using https://en.wikipedia.org/wiki/Haversine_formula
  const phi1 = deg2rad(p1.x)
  const lba1 = deg2rad(p1.y)
  const phi2 = deg2rad(p2.x)
  const lba2 = deg2rad(p2.y)

  const r = 6371 * 1e3 // Earth's radius: 6371kms in meters
  return 2 * r * Math.asin(Math.sqrt(Math.sin((phi2 - phi1) / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lba2 - lba1) / 2) ** 2))
}


fileStream
  .pipe(JSONStream.parse('locations.*'))
  .pipe(
    es.through(
      function write(data) {
        const unixTimestamp = Number.parseInt(data.timestampMs)

        if (unixTimestamp < from)
          return

        if (unixTimestamp > to)
          return

        const dist = dist2points(point,
          { x: data.latitudeE7 / 1e7, y: data.longitudeE7 / 1e7 })

        if (dist > maxDist)
          return

        points.push(data)
      },
      function end() {
        processPoints()
        this.emit('end')
      })
  )

const processPoints = () => {
  let max = 0
  let min = Number.MAX_VALUE

  points.forEach(p => {
    const unixTimestamp = Number.parseInt(p.timestampMs)

    if (unixTimestamp > max)
      max = unixTimestamp

    if (unixTimestamp < min)
      min = unixTimestamp
  })

  console.log(moment(max).diff(moment(min), 'hours', true))
}
