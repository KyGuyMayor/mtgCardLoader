const express = require('express'); //Line 1
const app = express(); //Line 2
const port = process.env.PORT || 5000; //Line 3
const card = require('./router/card');
const set = require('./router/set');
const auth = require('./router/auth');
const collections = require('./router/collections');

app.use(express.json());

app.use('/cards', card);
app.use('/sets', set);
app.use('/auth', auth);
app.use('/collections', collections);

// This displays message that the server running and listening to specified port
app.listen(port, () => console.log(`Listening on port ${port}`)); //Line 6
