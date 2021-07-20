const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

class TaskQueue extends EventEmitter {
    constructor(concurrency) {
        super();
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
        this.completed = 0;
    }

    pushTask(task) {
        this.queue.push(task);
        process.nextTick(this.next.bind(this));
        return this;
    }

    next() {
        if (this.running === 0 && this.queue.length === 0) return this.emit('empty');

        while (this.running < this.concurrency && this.queue.length) {
            const task = this.queue.shift();
            task((err) => {
                if (err) this.emit('error', err);

                this.running -= 1;
                process.nextTick(this.next.bind(this));
            });
            this.running += 1;
        }
    }
}

function searchTask(dir, keyword, queue, matchedFiles, done) {
    fs.readdir(dir, {}, (err, files) => {
        if (err) return done(err);

        function iterateFiles(files, index) {
            const file = `${dir}/${files[index]}`;
            fs.lstat(file, (err, stats) => {
                if (err) return done(err);

                const isDirectory = stats.isDirectory();

                if (isDirectory) {
                    queue.pushTask((done) => {
                        searchTask(file, keyword, queue, matchedFiles, done);
                    });

                    if (index === files.length - 1) return done();
                    if (files.length) iterateFiles(files, index + 1);
                } else {
                    fs.readFile(file, 'utf8', (err, content) => {
                        if (err) return done(err);

                        if (content.includes(keyword)) matchedFiles.push(file);

                        if (index === files.length - 1) return done();
                        if (files.length) iterateFiles(files, index + 1);
                    });
                }
            });
        }

        if (files.length) iterateFiles(files, 0);
    });
}

function recursiveFind(dir, keyword, cb) {
    const matchedFiles = [];
    const taskQueue = new TaskQueue(3);
    taskQueue.on('error', (err) => cb(err));
    taskQueue.on('empty', () => cb(null, matchedFiles));

    taskQueue.pushTask((done) => {
        searchTask(dir, keyword, taskQueue, matchedFiles, done);
    });
}

recursiveFind(
    '/home/juraj/Node.js-Design-Patterns-Third-Edition/04-asynchronous-control-flow-patterns-with-callbacks/11-web-spider-v4',
    'spider',
    (err, files) => {
        if (err) return console.error(err);
        console.log('Matched files:', files);
    }
);
