const IS_SANDBOX = false; 
const TOYYIB_SECRET = ''; 
const TOYYIB_CAT = ''; 

export const createToyyibBill = async (amount, orderId, customerPhone, customerName, customerEmail) => {
  const baseUrl = IS_SANDBOX 
    ? 'https://dev.toyyibpay.com' 
    : 'https://toyyibpay.com';

  const amountInCents = Math.round(parseFloat(amount) * 100);

  // --- SAFETY GUARDS ---
  const finalName = (customerName && customerName.trim() !== '') ? customerName : 'Customer';
  const finalEmail = (customerEmail && customerEmail.includes('@')) ? customerEmail : 'customer@ministall.com';
  const finalPhone = (customerPhone && customerPhone.length >= 10) ? customerPhone : '0123456789';

  const tableNum = orderId.includes('-') ? orderId.split('-')[1] : '0';

  const details = {
    userSecretKey: TOYYIB_SECRET,
    categoryCode: TOYYIB_CAT,
    billName: 'MiniStall Order',
    billDescription: `Table ${tableNum} - Order ${orderId}`,
    billPriceSetting: '1',
    billPayorInfo: '1',
    billAmount: amountInCents.toString(),
    // FIXED: Corrected the URL to match your Firebase Hosting domain
    billReturnUrl: 'https://ministall-app.web.app/customer/success', 
    billCallbackUrl: 'https://us-central1-ministall-app.cloudfunctions.net/toyyibpayWebhook',
    
    billExternalReferenceNo: orderId,
    billTo: finalName, 
    billEmail: finalEmail,
    billPhone: finalPhone,
  };

  const formBody = Object.keys(details)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
    .join('&');

  try {
    const response = await fetch(`${baseUrl}/index.php/api/createBill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });
    
    const responseText = await response.text(); 
    console.log("Raw ToyyibPay Response:", responseText);

    if (responseText.trim() === '[FALSE]') {
        console.error("ToyyibPay API rejected the request. Check if Secret Key/Category or Whitelist is correct.");
        return null;
    }

    try {
      const result = JSON.parse(responseText);
      if (Array.isArray(result) && result[0]?.BillCode) {
        // This returns the direct payment link
        return `${baseUrl}/${result[0].BillCode}`;
      }
      return null;
    } catch (jsonErr) {
      console.error("JSON Parse failed. Response was:", responseText);
      return null;
    }

  } catch (error) {
    console.error("Network Error:", error);
    return null;
  }
};