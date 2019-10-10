// Download your own Location History JSON file at https://takeout.google.com/settings/takeout
const JSONStream = require('JSONStream')
const es = require('event-stream')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const { jsonFile, resultFolder, resultFileName, from, to, maxDist, maxDeltaTime, pointOfInterest } = require('./params')
const { createResultFolder, distBwPoints, num2roundedStr: num2RoundedStr } = require('./utils')

console.time('process')

createResultFolder()

let lastData = null
const result = {}

const processPoint = data => {
  const point = { x: data.latitudeE7 / 1e7, y: data.longitudeE7 / 1e7 }
  const dist = distBwPoints(pointOfInterest, point)

  if (dist > maxDist)
    return

  const unixTimestamp = Number.parseInt(data.timestampMs)

  if (from && unixTimestamp < from)
    return

  if (to && unixTimestamp > to)
    return

  const date = moment(unixTimestamp)


  console.timeLog('process', `${date.format('DD MMMM YYYY')} ${unixTimestamp}`)

  if (!lastData) {
    initPeriod(date)

    lastData = data
    return
  }

  const lpUnixTimestamp = Number.parseInt(lastData.timestampMs)
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

    lastData = data
    return
  }

  closeLastPeriod()
  initPeriod(date)

  lastData = data
}

const printResult = () => {
  closeLastPeriod()

  const resultFile = fs.createWriteStream(`./${resultFolder}/${resultFileName}.txt`, { flags: 'a+' })

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

  resultFile.write(`${header}\n`)

  for (let year in result) {
    let indent = '\n'
    const duration = moment.duration(result[year].duration, 'milliseconds')

    const days = Math.floor(duration.asDays())
    const hours = num2RoundedStr(duration.hours())
    const minutes = num2RoundedStr(duration.minutes())
    const seconds = num2RoundedStr(duration.seconds())

    resultFile.write(`${indent}${year} (${days} ${hours}:${minutes}:${seconds})`)

    for (let month in result[year]) {
      if (month === 'duration') continue

      indent = '\n\t'

      const duration = moment.duration(result[year][month].duration, 'milliseconds')

      const days = Math.floor(duration.asDays())
      const hours = num2RoundedStr(duration.hours())
      const minutes = num2RoundedStr(duration.minutes())
      const seconds = num2RoundedStr(duration.seconds())

      resultFile.write(`${indent}${month} (${days} ${hours}:${minutes}:${seconds})`)

      for (let day in result[year][month]) {
        if (day === 'duration') continue

        indent = '\n\t\t'

        const duration = moment.duration(result[year][month][day].duration, 'milliseconds')

        const hours = num2RoundedStr(Math.floor(duration.asHours()))
        const minutes = num2RoundedStr(duration.minutes())
        const seconds = num2RoundedStr(duration.seconds())

        resultFile.write(`${indent}${day} (${hours}:${minutes}:${seconds})`)


        result[year][month][day].periods.forEach(p => {
          indent = '\n\t\t\t'

          const duration = moment.duration(p.duration, 'milliseconds')

          const hours = num2RoundedStr(Math.floor(duration.asHours()))
          const minutes = num2RoundedStr(duration.minutes())
          const seconds = num2RoundedStr(duration.seconds())
          resultFile.write(`${indent}${p.from} — ${p.to} (${hours}:${minutes}:${seconds})`)
        })
      }
    }

    if (!Object.keys(result).length)
      resultFile.write('\nno results')

    // resultFile.end()

    console.timeLog('process', path.resolve(__dirname, resultFile.path))
    console.timeEnd('process')
  }
}

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
  if (!lastData) return

  const lpUnixTimestamp = Number.parseInt(lastData.timestampMs)
  const lastDate = moment(lpUnixTimestamp)
  const lastYear = lastDate.format('YYYY')
  const lastMonth = lastDate.format('MMMM')
  const lastDay = lastDate.format('DD')

  if (!result[lastYear][lastMonth][lastDay])
    return

  const periods = result[lastYear][lastMonth][lastDay].periods
  let lastPeriod = periods[periods.length - 1]
  lastPeriod.to = lastDate.format('HH:mm')
}

fs.createReadStream(`./${jsonFile}.json`, { encoding: 'utf8' })
  .pipe(JSONStream.parse('locations.*'))
  .pipe(es.through(processPoint, function end() {
    console.timeLog('process', 'done reading file...')
    printResult()
  }))