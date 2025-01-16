const { handler } = require('./server');

exports.handler = handler;

if (require.main === module) {
    const { init } = require('./server');
    init()
        .then(server => {
            server.start();
            console.log('Server running at:', server.info.uri);
        })
        .catch(err => {
            console.error('Failed to start server:', err);
            process.exit(1);
        });
}
