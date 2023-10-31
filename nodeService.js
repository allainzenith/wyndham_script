const Service = require('node-windows').Service

const svc = new Service({
    name: "wyndhamService1.1",
    description: "This is a script for scraping the Wyndham site and uploading it on Guesty.",
    script: "C:\\Users\\unnamed89201\\Desktop\\Allain Documents\\OTHERS\\mittenhousing-new\\bin\\www"
})

svc.on('install', function(){
    svc.start()
})

svc.install()