const app = require('./app');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(PORT, () => {
  console.log(`[calllogix] backend listening on :${PORT}`);
});
