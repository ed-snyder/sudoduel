# StoreKit Configuration Setup

This guide explains how to enable the StoreKit Configuration file for local testing of in-app purchases.

## File Created

The `Products.storekit` file has been created at:
```
web-client/ios/App/App/Products.storekit
```

This file contains:
- **sudoduel_plus_monthly** - $3.99/month subscription
- **sudoduel_plus_yearly** - $29.99/year subscription

Both products are in the "Sudoduel Plus" subscription group.

## Step 1: Add File to Xcode Project

1. Open `web-client/ios/App/App.xcworkspace` in Xcode
2. Right-click on the `App` folder in the Project Navigator
3. Select **"Add Files to App..."**
4. Navigate to and select `Products.storekit`
5. Make sure **"Copy items if needed"** is **UNCHECKED** (file already exists)
6. Make sure **"Add to targets: App"** is **CHECKED**
7. Click **"Add"**

## Step 2: Enable StoreKit Configuration in Scheme

1. In Xcode, go to **Product → Scheme → Edit Scheme...**
2. Select **Run** on the left sidebar
3. Go to the **Options** tab
4. Find **"StoreKit Configuration"** dropdown
5. Select **"Products.storekit"** from the dropdown
6. Click **"Close"**

## Step 3: Clean and Rebuild

1. **Product → Clean Build Folder** (Shift + Cmd + K)
2. **Product → Build** (Cmd + B)
3. Run the app on your device or simulator

## Testing

When you tap the purchase button:
- ✅ Apple payment sheet should appear
- ✅ Uses Xcode's local StoreKit (no real money)
- ✅ Purchase should complete successfully
- ✅ Products should load immediately

## Troubleshooting

### Products still not loading?

1. **Verify the file is in the project:**
   - Check Project Navigator for `Products.storekit`
   - If missing, re-add it (Step 1)

2. **Verify scheme configuration:**
   - Product → Scheme → Edit Scheme → Run → Options
   - Ensure "Products.storekit" is selected (not "None")

3. **Check product IDs match:**
   - Open `Products.storekit` in Xcode
   - Verify product IDs are exactly:
     - `sudoduel_plus_monthly`
     - `sudoduel_plus_yearly`

4. **Clean build:**
   - Product → Clean Build Folder
   - Delete Derived Data (Xcode → Preferences → Locations → Derived Data → Delete)

### Still having issues?

Check the console logs for:
- `[PurchaseService] Ready. Products: []` - Should show both product IDs
- `[PurchaseService] Store.products:` - Should show product objects

If products are still empty, the StoreKit Configuration may not be active. Double-check the scheme settings.

## Before App Store Submission

⚠️ **IMPORTANT:** Before submitting to App Store:

1. **Disable StoreKit Configuration:**
   - Product → Scheme → Edit Scheme → Run → Options
   - Set "StoreKit Configuration" back to **"None"**

2. **Test with real Sandbox:**
   - Configure products in App Store Connect
   - Use Sandbox tester accounts
   - Test actual purchase flow

3. **Verify backend integration:**
   - Ensure purchase receipts are validated server-side
   - Test subscription renewal logic

## Notes

- StoreKit Configuration only works in **Debug** builds
- **Release** builds will always use App Store Connect
- This is for **development testing only**
- No real transactions occur with StoreKit Configuration
