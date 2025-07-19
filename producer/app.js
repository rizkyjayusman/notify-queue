const express = require('express');
const { publishNotification } = require('./queue/publisher');

const app = express();
app.use(express.json());

// Simulate create order
app.post('/create-order', async (req, res) => {
  const { user_id, order_id } = req.body;

  const message = {
    type: 'order_created',
    user_id: String(user_id),
    order_id,
    message: `Order #${order_id} has been created!`
  };

  await publishNotification(message);

  res.status(200).json({ success: true, sent: message });
});

app.listen(3000, () => {
  console.log('Producer running on http://localhost:3000');
});
