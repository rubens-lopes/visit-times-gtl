// Download your own Location History JSON file at https://takeout.google.com/settings/takeout
const JSONStream = require('JSONStream')
const es = require('event-stream')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const { jsonFile, resultFolder, resultFileName, from, to, maxDist, maxDeltaTime, pointOfInterest } = require('./params')
const { createResultFolder, distBwPoints, num2roundedStr, getMonthName } = require('./utils')

console.time('process')

createResultFolder()

let lastData = null
const result = {}
let totalPoints = 0

const processPoint = data => {
  console.timeLog('process', `${data.unixTimestamp}`)

  initDate(data)

  const ldUnixTimestamp = lastData && lastData.unixTimestamp
  const duration = data.unixTimestamp - ldUnixTimestamp

  if (duration > maxDeltaTime) {
    initPeriod(data)
  }
  else {
    result[data.dateObj.years].duration += duration
    result[data.dateObj.years][data.month].duration += duration
    result[data.dateObj.years][data.month][data.dateObj.date].duration += duration

    const periods = result[data.dateObj.years][data.month][data.dateObj.date].periods
    const thisPeriod = periods[periods.length - 1]
    thisPeriod.duration += duration
  }

  lastData = data
}

const initDate = data => {
  const year = data.dateObj.years
  if (!result.hasOwnProperty(year))
    result[year] = { duration: 0 }

  const month = data.month
  if (!result[year].hasOwnProperty(month))
    result[year][month] = { duration: 0 }

  const date = data.dateObj.date
  if (!result[year][month].hasOwnProperty(date))
    result[year][month][date] = {
      periods: [],
      duration: 0,
    }
}

const initPeriod = data => {
  closeLastPeriod()

  const month = data.month
  const periods = result[data.dateObj.years][month][data.dateObj.date].periods

  periods.push({
    from: `${num2roundedStr(data.dateObj.hours)}:${num2roundedStr(data.dateObj.minutes)}`,
    to: '',
    duration: 0,
  })
}

const closeLastPeriod = () => {
  if (!lastData) return

  const month = lastData.month
  const date = result[lastData.dateObj.years][month][lastData.dateObj.date]

  const lastPeriod = date.periods[date.periods.length - 1]
  lastPeriod.to = `${num2roundedStr(lastData.dateObj.hours)}:${num2roundedStr(lastData.dateObj.minutes)}`
}

const filterByParams = data => {
  const point = { x: data.latitudeE7 / 1e7, y: data.longitudeE7 / 1e7 }
  const dist = distBwPoints(pointOfInterest, point)

  if (dist > maxDist)
    return

  const timestamp = moment(data.timestamp)

  if (timestamp.isBefore(from))
    return

  if (timestamp.isAfter(to))
    return

  const dateObj = timestamp.toObject()
  totalPoints++

  return {
    unixTimestamp: timestamp,
    month: getMonthName(dateObj.months),
    dateObj
  }
}

const writeResult = () => {
  console.time('write result file')
  closeLastPeriod()

  const resultFile = fs.createWriteStream(`./${resultFolder}/${resultFileName}.txt`, { flags: 'a+' })

  const formatedFrom = from ? moment(from).format('DD/MM/YYYY HH:mm:ss') : ''
  const formatedTo = to ? moment(to).format('DD/MM/YYYY HH:mm:ss') : ''

  let header = `from: ${formatedFrom}`
  header += `\nto: ${formatedTo}`
  header += `\nmaxDist: ${maxDist} m`
  header += `\nmaxDeltaTime: ${moment.duration(maxDeltaTime, 'milliseconds').humanize()},`
  header += `\npoints found: ${totalPoints}`
  header += `\npointOfInterest: ${pointOfInterest.x} ${pointOfInterest.y}`

  resultFile.write(`${header}\n`)

  for (let year in result) {
    let indent = '\n'
    const duration = moment.duration(result[year].duration, 'milliseconds')

    const days = Math.floor(duration.asDays())
    const hours = num2roundedStr(duration.hours())
    const minutes = num2roundedStr(duration.minutes())
    const seconds = num2roundedStr(duration.seconds())

    resultFile.write(`${indent}${year} (${days} ${hours}:${minutes}:${seconds})`)

    for (let month in result[year]) {
      if (month === 'duration') continue

      indent = '\n\t'

      const duration = moment.duration(result[year][month].duration, 'milliseconds')

      const days = Math.floor(duration.asDays())
      const hours = num2roundedStr(duration.hours())
      const minutes = num2roundedStr(duration.minutes())
      const seconds = num2roundedStr(duration.seconds())

      resultFile.write(`${indent}${month} (${days} ${hours}:${minutes}:${seconds})`)

      for (let day in result[year][month]) {
        if (day === 'duration') continue

        indent = '\n\t\t'

        const duration = moment.duration(result[year][month][day].duration, 'milliseconds')

        const hours = num2roundedStr(Math.floor(duration.asHours()))
        const minutes = num2roundedStr(duration.minutes())
        const seconds = num2roundedStr(duration.seconds())

        resultFile.write(`${indent}${num2roundedStr(day)} (${hours}:${minutes}:${seconds})`)


        result[year][month][day].periods.forEach(p => {
          indent = '\n\t\t\t'

          const duration = moment.duration(p.duration, 'milliseconds')

          const hours = num2roundedStr(Math.floor(duration.asHours()))
          const minutes = num2roundedStr(duration.minutes())
          const seconds = num2roundedStr(duration.seconds())

          resultFile.write(`${indent}${p.from} — ${p.to} (${hours}:${minutes}:${seconds})`)
        })
      }
    }
  }

  resultFile.end()

  console.timeEnd('write result file')
  console.timeEnd('process')

  console.log(path.resolve(__dirname, resultFile.path))
}

fs.createReadStream(`./${jsonFile}.json`, { encoding: 'utf8' })
  .pipe(JSONStream.parse('locations.*', filterByParams))
  .pipe(es.through(processPoint, writeResult))