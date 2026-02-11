const functions = require("firebase-functions");
const admin = require("firebase-admin");

// This is the logic ONLY for subscriptions
exports.vendorSubscriptionWebhook = functions.https.onRequest(async (req, res) => {
  const vendorId = req.body.billExternalReferenceNo;
  const status = req.body.status;
  const billAmount = req.body.billAmount; // Use this to determine days

  console.log(`[Subscription Webhook] ID: ${vendorId}, Status: ${status}`);

  if (status === '1' && vendorId) {
    try {
      const userRef = admin.firestore().collection("users").doc(vendorId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const now = new Date();
        let currentExpiry = userData.expiryDate ? userData.expiryDate.toDate() : new Date();
        const baseDate = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseDate);

        // Determine how many days to add based on amount
        // ToyyibPay sends amount in decimals (e.g., 40.00)
        let daysToAdd = 30;
        if (parseFloat(billAmount) >= 140) daysToAdd = 120;
        else if (parseFloat(billAmount) >= 75) daysToAdd = 60;

        newExpiry.setDate(newExpiry.getDate() + daysToAdd);

        await userRef.update({
          status: "active",
          expiryDate: admin.firestore.Timestamp.fromDate(newExpiry),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Vendor ${vendorId} extended by ${daysToAdd} days.`);
      }
      return res.status(200).send("OK");
    } catch (error) {
      console.error("Subscription Error:", error);
      return res.status(500).send("Error");
    }
  }
  res.status(200).send("OK");
});