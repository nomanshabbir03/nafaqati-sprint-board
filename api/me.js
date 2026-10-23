const { send, route, isEditor, isOpen } = require('../lib/http');

module.exports = route({
  GET: (req, res) => send(res, 200, { canEdit: isEditor(req), open: isOpen() })
});
