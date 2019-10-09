const fs = require('fs')
const moment = require('moment')

const timerStart = moment()

const fileName = timerStart.toISOString(true).replace(/\:/g, '')
const resultFile = fs.createWriteStream(`${fileName}.txt`, { flags: 'a+' })

const processingTime = `processing time: ${moment.duration(moment().diff(timerStart)).humanize()}`
console.log(processingTime)

resultFile.write('result')
resultFile.write(processingTime)
resultFile.end()