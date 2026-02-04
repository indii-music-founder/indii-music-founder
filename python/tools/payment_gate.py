from python.helpers.tool import Tool, Response
import time
import json
import os

class PaymentGate(Tool):
    """
    Human-in-the-Loop Payment Bridge (Task 10).
    Stops automation when a fee is required and waits for explicit user approval.
    """
    
    async def execute(self, amount, vendor, reason, **kwargs):
        self.set_progress(f"⚠️ PAYMENT REQUIRED: {amount} for {vendor}")
        
        # 1. Create the Payment Request Artifact
        request_id = f"pay_{int(time.time())}"
        request_data = {
            "id": request_id,
            "amount": amount,
            "vendor": vendor,
            "reason": reason,
            "status": "PENDING",
            "timestamp": time.time(),
            "currency": "USD" # Default for now
        }
        
        # 2. Persist the request (File-based for now, Firestore later)
        # In a real app, this would push to a 'payouts' collection in Firestore
        # For the local agent, we write to a 'pending_payments' directory
        payment_dir = os.path.join(os.getcwd(), "payments")
        if not os.path.exists(payment_dir):
            os.makedirs(payment_dir, exist_ok=True)
            
        request_path = os.path.join(payment_dir, f"{request_id}.json")
        with open(request_path, "w") as f:
            json.dump(request_data, f, indent=2)
            
        # 3. Output the UI Signal (The "Stop and Ask" card)
        # This tells the chat UI to render a special "Approve Payment" button
        ui_signal = f"**PAYMENT APPROVAL REQUIRED**\n\n**Vendor:** {vendor}\n**Amount:** {amount}\n**Reason:** {reason}\n\nWaiting for approval..."
        
        # 4. Wait Loop (The Human-in-the-Loop)
        # The agent hangs here until the file status changes to APPROVED
        timeout = 300 # 5 minutes
        start_time = time.time()
        
        while (time.time() - start_time) < timeout:
            await asyncio.sleep(2) # Poll every 2s
            
            if os.path.exists(request_path):
                with open(request_path, "r") as f:
                    try:
                        current_status = json.load(f).get("status")
                        if current_status == "APPROVED":
                            self.set_progress("✅ Payment Approved. Resuming...")
                            return Response(message=f"Payment of {amount} to {vendor} APPROVED. Proceeding.", break_loop=False)
                        elif current_status == "REJECTED":
                            self.set_progress("❌ Payment Rejected.")
                            return Response(message="Payment REJECTED by user. Halting process.", break_loop=True)
                    except:
                        pass
            
        return Response(message="Payment request timed out.", break_loop=True)
