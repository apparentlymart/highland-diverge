var _ = require('highland');

function diverge(n) {
    return function (inStream) {
        var requests = _();
        var closed = false;

        requests.flatMap(function (request) {
            var push = request[0];
            var next = request[1];
            var i = request[2];

            if (closed) {
                push(null, _.nil);
                return _([]);
            }

            var ret = _();

            inStream.pull(function (err, x) {
                if (x === _.nil) {
                    closed = true;
                    push(null, _.nil);
                    ret.write(_.nil);
                    return;
                }
                push(err, x);
                next();
                ret.write(_.nil);
            });

            return ret;
        }).done(function () {
            // should never happen
            throw new Error('diverge request stream ended');
        });

        var streams = [];
        for (var i = 0; i < n; i++) {
            streams.push(_(generator));
        }
        return _(streams);

        function generator(push, next) {
            requests.write([push, next]);
        }
    };
}

module.exports = diverge;
