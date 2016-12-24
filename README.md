# require-node
A node middleware let browser js code can require node module

require-node make you can require back end javascript in front end (for example: Browser), and the back end javascript is still running at the back end, not in Browser.

require-node 让您能在前端（比如：浏览器）require后端javascript代码，而这些后端代码在执行时依然在后端执行，而非浏览器里。

## Installion
```
$ npm install require-node
```
**Note:** if you use require-node with **require.js** or **sea.js**, cann't Global install **(Install without -g parameter)**.

## Use
```
//middleware: function(req, res, next){ ... }
var middleware = require('require-node')({
    //path: '/call',
    //withCredentials: true,
    //isDebug: true,
    alias: {
        test: '/backEnd/test'
    }
})
```

You can use this middleware in node [EXPRESS](https://www.npmjs.com/package/express)
```
var express = require('express')
var app = express()
app.use(middleware)
```

You can also use this middleware in node HTTP
```
require('http').createServer(function (req, res) {
    middleware(req, res, function () {
        //req that require-node not process
    }
})
```

In Front End, there are three ways to use require-node

在前端，有三种方式使用require-node

## 1. With: Require.js

```
demo/
    |--node_modules/
    |   `--require-node/
    |--backEnd/
    |   `--test.js
    |--frontEnd/
    |   `--index.js
    |--index.html
    `--server.js
```

### Front end javascript code (RUN in Browser)
index.html
```
<html>
<head>
    <script src="http://apps.bdimg.com/libs/require.js/2.1.11/require.min.js" data-main="./frontEnd/index"></script>
    <!--script>require(["./frontEnd/index"])</script-->
</head>
<body>
</body>
</html>
```
frontEnd/index.js
```
define(function (require, exports, module) {
    console.log = console.error = function () { var log = console.log; return function (msg) { log(msg); document.body.innerHTML += msg + '<br/>' } } ()

    var test = require('../backEnd/test');

    test.say('luoshaohua', new Date())
        .then(function (result) {
            console.log(result)
        }, function (err) {
            console.error(err)
        })

    test.say_callback('luoshaohua', new Date())
        .then(function (result) {
            console.log(result)
        }, function (err) {
            console.error(err)
        })

    test.say_promise('luoshaohua', new Date())
        .then(function (result) {
            console.log(result)
        }, function (err) {
            console.error(err)
        })
});
```

### Back end javascript code (RUN in Node Server)
server.js
```
var middleware = require('require-node')({
    //path: '/call',
    //withCredentials: true,
    //isDebug: true,
    alias: {
        test: '/backEnd/test'
    }
})

require('http').createServer(function (req, res) {
    middleware(req, res, function () {
        if (req.url === '/') {
            res.end(require('fs').readFileSync('./index.html'));
            return;
        }

        var filePath = req.url;
        if (filePath.startsWith('/frontEnd/') || filePath.startsWith('/node_modules/')) {
            res.end(require('fs').readFileSync('.' + filePath));
        }
        else {
            res.statusCode = 404;
            res.end('');
        }
    })
}).listen(2000);

console.log('Server running at http://127.0.0.1:2000/');
```

backEnd/test.js
```
function say(name, now) {
    if (name) {
        return '【SYNC】 Hello ' + name + ', now server time is: ' + now;
    }
    else {
        throw '【SYNC】 No name'
    }
}

function say_callback(name, now, callback) {
    setTimeout(function () {
        if (name) {
            callback(null, '【CALLBACK】 Hello ' + name + ', now server time is: ' + now)
        }
        else {
            callback('【CALLBACK】 No name')
        }
    }, 1000)
}

function say_promise(name, now) {
    return new Promise(function (resolve, reject) {
        if (name) {
            resolve('【PROMISE】 Hello ' + name + ', now server time is: ' + now);
        }
        else {
            reject('【PROMISE】 No name');
        }
    })
}

exports.say = say;
exports.say_callback = say_callback;
exports.say_promise = say_promise;
```

### Browser loaded index.html and Output
After run command:
```
$ node server.js 
```
Access url: http://127.0.0.1:2000 in your Browser, you will get:
```
【SYNC】 Hello luoshaohua, now server time is: Fri Dec 23 2016 15:14:08 GMT+0800 (中国标准时间)
【PROMISE】 Hello luoshaohua, now server time is: Fri Dec 23 2016 15:14:08 GMT+0800 (中国标准时间)
【CALLBACK】 Hello luoshaohua, now server time is: Fri Dec 23 2016 15:14:08 GMT+0800 (中国标准时间)
```
**Note: say(...) functon is run in node server, the time is node server's time.**


## 2. With: Sea.js
You only need to modify the index.html, the other files are same with the above (Require.js).

index.html
```
<html>
<head>
    <script src="http://apps.bdimg.com/libs/seajs/2.3.0/sea.js"></script>
    <script>seajs.use("./frontEnd/index")</script>
</head>
<body>
</body>
</html>
```


## 3. With: Webpack
You only need to modify the index.html and add webpack config file, the other files are same with the above (Require.js).

You need run webpack to Compile index.js to build.js, help with package: [require-node-loader](https://www.npmjs.com/package/require-node-loader)

index.html
```
<html>
<head>
    <script src="./frontEnd/build.js"></script>
</head>
<body>
</body>
</html>
```
webpack config file: webpack.config.js
```
module.exports = {
    module: {
        loaders: [
            {
                //test: /\.js$/, loader: 'require-node-loader?path=/call&withCredentials=true&isDebug=true',
                test: /\.js$/, loader: 'require-node-loader',
                include: [
                    require('path').resolve(__dirname, "backEnd")
                ]
            }
        ]
    },
    entry: { 'frontEnd/build.js': './frontEnd/index.js' },
    output: {
        path: __dirname,
        filename: '[name]'
    }
}
```
For more information about webpack, click [here](https://webpack.github.io/)


## Config options

**1. alias: { name: '/path/to/backEnd.js' }**
> config which back end file can be use in front end

**2. path: '/require-node'** (default)
> config which url path to send ajax

**3. withCredentials: false** (default)
> IN CROSS DOMAIN, config XMLHttpRequest object with cookie or not

**4. isDebug: false** (default)
> config require-node output log or not

**5. resolve: function(req, moduleName, functionName, formalParams){ return true/promise }**
> Sometimes, for security reasons, we will prevent some function calls. For each http request before processing, require-node calls this resolve configuration function, if the return is not true or promise resolve not true, call will be prevent.


## Inject Service
If your back end function want use variable **$req**、**$res**、**$session**、http **$body**, you can define back end function like this:
```
function say(arg1, arg2, $req, otherArg1, otherArg2){
    console.log($req)
}
exports.say = say
```
require-node will inject variable req to $req.

Like Angular Inject Service Style !!!