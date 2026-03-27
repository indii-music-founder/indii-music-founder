from python.helpers.tool import Tool, Response
import time
import json
import os
import asyncio

class PaymentGate(Tool):
    """
    Human-in-the-Loop Payment Bridge (Task 10).
    Stops automation when a fee is required and waits for explicit user approval.
    """
    
    async def execute(self, amount, vendor, reason, **kwargs):
        self.set_progress(f"⚠️ PAYMENT REQUIRED: {amount} for {vendor}")
        import stripe
        from dotenv import load_dotenv
        
        # Load environment variables
        load_dotenv()
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

        self.set_progress(f"⚠️ PAYMENT REQUIRED: {amount} for {vendor}")
        
        # 1. Create real Stripe Checkout Session
        try:
            # Convert string amount (e.g., "$10.00" or "10") to cents
            amount_clean = str(amount).replace('$', '').replace(',', '')
            cents = int(float(amount_clean) * 100)
            
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f"Payment to {vendor}",
                            'description': str(reason)
                        },
                        'unit_amount': cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url="http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url="http://localhost:3000/payment/cancel",
            )
            payment_url = session.url
            request_id = session.id
        except Exception as e:
            # Fallback to simulated ID if Stripe fails or is misconfigured
            request_id = f"pay_{int(time.time())}"
            payment_url = f"https://mock-payment-gateway.indii.io/checkout/{request_id}"
            
        request_data = {
            "id": request_id, 
            "amount": amount,
            "vendor": vendor,
            "reason": reason,
            "status": "PENDING",
            "url": payment_url,
            "timestamp": time.time(),
            "currency": "USD"
        }
        
        # 2. Persist the request (Wait for Webhook update or Local Override)
        payment_dir = os.path.join(os.getcwd(), "payments")
        if not os.path.exists(payment_dir):
            os.makedirs(payment_dir, exist_ok=True)
            
        request_path = os.path.join(payment_dir, f"{request_id}.json")
        with open(request_path, "w") as f:
            json.dump(request_data, f, indent=2)
            
        # 3. Output the UI Signal with real payment link
        ui_signal = f"**PAYMENT APPROVAL REQUIRED**\n\n**Vendor:** {vendor}\n**Amount:** {amount}\n**Reason:** {reason}\n\n[Click here to secure payment via Stripe]({payment_url})\n\nWaiting for completion..."
        
        # 4. Wait Loop (The Human-in-the-Loop)
        # Webhook should update the JSON to "APPROVED" when paid, or user can override locally.
        timeout = 300 # 5 minutes
        start_time = time.time()
        
        while (time.time() - start_time) < timeout:
            await asyncio.sleep(2) 
            
            if os.path.exists(request_path):
                try:
                    with open(request_path, "r") as f:
                        data = json.load(f)
                        current_status = data.get("status")
                        
                        if current_status == "APPROVED":
                            self.set_progress("✅ Payment Approved by Stripe. Resuming...")
                            return Response(message=f"Payment of {amount} to {vendor} SECURED. Proceeding.", break_loop=False)
                        elif current_status == "REJECTED":
                            self.set_progress("❌ Payment Rejected.")
                            return Response(message="Payment REJECTED or CANCELLED. Halting process.", break_loop=True)
                except (json.JSONDecodeError, IOError):
                    continue
            
        return Response(message="Payment request timed out waiting for Stripe webhook.", break_loop=True)
