const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.toyyibpayWebhook = functions.https.onRequest(async (req, res) => {
  // ToyyibPay sends the ID back in 'billExternalReferenceNo' 
  // because that is what we used in the createBill request.
  const orderId = req.body.billExternalReferenceNo || req.body.order_id;
  const status = req.body.status;
  const billcode = req.body.billcode;

  console.log(`Received Webhook for Order: ${orderId}, Status: ${status}`);

  if (status === '1' && orderId) {
    try {
      const orderRef = admin.firestore().collection("orders").doc(orderId);
      
      await orderRef.update({
        status: "received", 
        paymentStatus: "PAID",
        toyyibPayBillCode: billcode || '',
        paidAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Order ${orderId} successfully updated to received.`);
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Error updating Firestore:", error);
      return res.status(500).send("Internal Error");
    }
  }

  // Always respond with 200 OK so ToyyibPay doesn't keep retrying
  res.status(200).send("OK");
});

exports.sub = require('./subscriptions');