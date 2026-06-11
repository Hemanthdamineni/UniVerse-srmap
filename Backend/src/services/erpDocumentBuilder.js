const {
  buildTextNode,
  buildTableNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
  buildContainerNode,
} = require("./erpDocumentBuilder/nodeFactories");
const { buildDocument } = require("./erpDocumentBuilder/domWalker");

module.exports = {
  buildTextNode,
  buildTableNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
  buildContainerNode,
  buildDocument,
};
