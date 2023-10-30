const Service = require('node-windows').Service

const svc = new Service({
    name: "wyndhamScript",
    description: "This is a script for scraping the Wyndham site and uploading it on Guesty.",
    // script: "C:\\Users\\Administrator\\Desktop\\mittenhousing-new\\bin\\www"
})

svc.on('install', function(){
    svc.start()
})

svc.install()