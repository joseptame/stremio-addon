const { manifest } = require("../lib/data");

module.exports = (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(manifest);
};
