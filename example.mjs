// code is poetry
import Holesail from './index.js'

const instance = new Holesail({mode: 'server', port: '12345'})

await instance.connect(() => {
  console.log("I am thus runnning a holesail connection to Holesail.")
})

console.log(instance.info)