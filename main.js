// Download your own Location History JSON file at https://takeout.google.com/settings/takeout
const JSONStream = require('JSONStream')
const es = require('event-stream')
const fs = require('fs')
const moment = require('moment')
const path = require('path')

console.time('process')
console.timeLog('process')

if (!fs.existsSync('./results/'))
  fs.mkdirSync('./results/')

/* USER INPUT */
const fileStream = fs.createReadStream(
  './timeline.json',
  { encoding: 'utf8' }
)

const from = +moment('2019-09-01 00:00:00')
const to = +moment('2019-09-30 23:59:59')
const maxDist = 60
const maxDeltaTime = moment.duration(10, 'minutes').asMilliseconds()
const pointOfInterest = {
  x: -20.481060,
  y: -54.606517,
}
/* END — USER INPUT */

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

let lastPoint = null
const result = {}

const processPoint = point => {
  const dist = dist2points(
    pointOfInterest,
    { x: point.latitudeE7 / 1e7, y: point.longitudeE7 / 1e7 }
  )

  if (dist > maxDist)
    return

  const unixTimestamp = Number.parseInt(point.timestampMs)

  if (from && unixTimestamp < from)
    return

  if (to && unixTimestamp > to)
    return

  const date = moment(unixTimestamp)


  console.timeLog('process', `${date.format('DD MMMM YYYY')} ${unixTimestamp}`)

  if (!lastPoint) {
    initPeriod(date)

    lastPoint = point
    return
  }

  const lpUnixTimestamp = Number.parseInt(lastPoint.timestampMs)
  const duration = unixTimestamp - lpUnixTimestamp

  if (duration < maxDeltaTime) {
    const lastDate = moment(lpUnixTimestamp)
    const lastYear = lastDate.format('YYYY')
    const lastMonth = lastDate.format('MMMM')
    const lastDay = lastDate.format('DD')

    if (!result[lastYear][lastMonth][lastDay])
      initPeriod(lastDate)

    const periods = result[lastYear][lastMonth][lastDay].periods
    let thisPeriod = periods[periods.length - 1]

    result[lastYear].duration += duration
    result[lastYear][lastMonth].duration += duration
    result[lastYear][lastMonth][lastDay].duration += duration

    thisPeriod.duration += duration

    lastPoint = point
    return
  }

  closeLastPeriod()
  initPeriod(date)

  lastPoint = point
}

const printResult = () => {
  closeLastPeriod()

  const fileName = moment().toISOString().replace(/\:/g, '')
  const resultFile = fs.createWriteStream(`./results/${fileName}.txt`, { flags: 'a+' })

  const formatedFrom = from
    ? moment(from).format('DD/MM/YYYY HH:mm:ss')
    : ''
  const formatedTo = to
    ? moment(to).format('DD/MM/YYYY HH:mm:ss')
    : ''

  let header = `from: ${formatedFrom}`
  header += `\nto: ${formatedTo}`
  header += `\nmaxDist: ${maxDist} m`
  header += `\nmaxDeltaTime: ${moment.duration(maxDeltaTime, 'milliseconds').humanize()},`
  header += `\npointOfInterest: ${pointOfInterest.x} ${pointOfInterest.y}`

  resultFile.write(`${header}\n\n`)

  for (let year in result) {
    let indent = '\n'
    const duration = moment.duration(result[year].duration, 'milliseconds')

    const days = Math.floor(duration.asDays())
    const hours = numberAsRoundedStr(duration.hours())
    const minutes = numberAsRoundedStr(duration.minutes())
    const seconds = numberAsRoundedStr(duration.seconds())

    resultFile.write(`${year} (${days} ${hours}:${minutes}:${seconds})`)

    for (let month in result[year]) {
      if (month === 'duration') continue

      indent = '\n\t'

      const duration = moment.duration(result[year][month].duration, 'milliseconds')

      const days = Math.floor(duration.asDays())
      const hours = numberAsRoundedStr(duration.hours())
      const minutes = numberAsRoundedStr(duration.minutes())
      const seconds = numberAsRoundedStr(duration.seconds())

      resultFile.write(`${indent}${month} (${days} ${hours}:${minutes}:${seconds})`)


      for (let day in result[year][month]) {
        if (day === 'duration') continue

        indent = '\n\t\t'

        const duration = moment.duration(result[year][month][day].duration, 'milliseconds')

        const hours = numberAsRoundedStr(Math.floor(duration.asHours()))
        const minutes = numberAsRoundedStr(duration.minutes())
        const seconds = numberAsRoundedStr(duration.seconds())

        resultFile.write(`${indent}${day} (${hours}:${minutes}:${seconds})`)


        result[year][month][day].periods.forEach(p => {
          indent = '\n\t\t\t'

          const duration = moment.duration(p.duration, 'milliseconds')

          const hours = numberAsRoundedStr(Math.floor(duration.asHours()))
          const minutes = numberAsRoundedStr(duration.minutes())
          const seconds = numberAsRoundedStr(duration.seconds())
          resultFile.write(`${indent}${p.from} — ${p.to} (${hours}:${minutes}:${seconds})`)
        })
      }
    }

    if (!Object.keys(result).length)
      resultFile.write('\nno results')

    resultFile.end()

    console.timeLog('process', path.resolve(__dirname, resultFile.path))
    console.timeEnd('process')
  }
}

const numberAsRoundedStr = num => `00${num}`.substr(-2)

const initPeriod = date => {
  const year = date.format('YYYY')
  const month = date.format('MMMM')
  const day = date.format('DD')
  const time = date.format('HH:mm')

  if (!result.hasOwnProperty(year))
    result[year] = { duration: 0 }

  if (!result[year].hasOwnProperty(month))
    result[year][month] = { duration: 0 }

  if (!result[year][month].hasOwnProperty(day))
    result[year][month][day] = {
      periods: [],
      duration: 0,
    }

  if (!result[year][month][day].periods.some(p => p.from === time))
    result[year][month][day].periods.push({
      from: time,
      to: "",
      duration: 0
    })
}

const closeLastPeriod = () => {
  if (!lastPoint) return

  const lpUnixTimestamp = Number.parseInt(lastPoint.timestampMs)
  const lastDate = moment(lpUnixTimestamp)
  const lastYear = lastDate.format('YYYY')
  const lastMonth = lastDate.format('MMMM')
  const lastDay = lastDate.format('DD')

  const periods = result[lastYear][lastMonth][lastDay].periods
  let lastPeriod = periods[periods.length - 1]
  lastPeriod.to = lastDate.format('HH:mm')
}

fileStream
  .pipe(JSONStream.parse('locations.*'))
  .pipe(es.through(processPoint, function end() {
    console.timeLog('process', 'done reading file...')
    printResult()
  }))