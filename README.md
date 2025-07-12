
# Google Calendar Booking Integration

This project integrates Google Calendar event creation into a website form. Users can submit a form to create an event on a specific Google Calendar.

## Setup Instructions

### 1. Create a Service Account and Credentials

1.  **Go to the Google Cloud Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/)
2.  **Create a new project** or select an existing one.
3.  **Enable the Google Calendar API:**
    *   Navigate to **APIs & Services > Library**.
    *   Search for "Google Calendar API" and enable it.
4.  **Create a Service Account:**
    *   Navigate to **APIs & Services > Credentials**.
    *   Click **Create Credentials > Service account**.
    *   Give the service account a name (e.g., "calendar-booking-service").
    *   Click **Create and Continue**.
    *   Grant the service account the **Owner** role for simplicity in this example. For production, you would use more granular permissions.
    *   Click **Continue** and then **Done**.
5.  **Download the JSON Key:** // clientID 100287172599-ickq0ltlimrm3dgjarbmf72s8e0gru19.apps.googleusercontent.com 
    *   On the Credentials page, find your newly created service account.
    *   Click on the service account email.
    *   Go to the **Keys** tab.
    *   Click **Add Key > Create new key**.
    *   Select **JSON** as the key type and click **Create**.
    *   A JSON file will be downloaded. Rename it to `credentials.json` and place it in the root of your project directory.

### 2. Share Your Google Calendar

1.  **Open Google Calendar:** [https://calendar.google.com/](https://calendar.google.com/)
2.  **Find your Service Account's email address** in the `credentials.json` file (the value of the `client_email` key).
3.  **Share your calendar:**
    *   In Google Calendar, find the calendar you want to add events to.
    *   Click the three dots next to the calendar name and select **Settings and sharing**.
    *   Under **Share with specific people or groups**, click **Add people and groups**.
    *   Paste the service account's email address into the field.
    *   Set the permissions to **Make changes to events**.
    *   Click **Send**.

### 3. Find Your Calendar ID

1.  In the same **Settings and sharing** page for your calendar, scroll down to the **Integrate calendar** section.
2.  Your **Calendar ID** is listed there. It will look something like `your_email@gmail.com` or a long string ending in `@group.calendar.google.com`.
3.  Copy this Calendar ID and paste it into the `server.js` file, replacing `YOUR_CALENDAR_ID`.

### 4. Install Dependencies and Run the Server

1.  **Install Node.js and npm** if you haven't already: [https://nodejs.org/](https://nodejs.org/)
2.  **Open your terminal** in the project directory.
3.  **Install the required npm packages:**

    ```bash
    npm install express googleapis
    ```

4.  **Run the server:**

    ```bash
    node server.js
    ```

5.  **Open your `index.html` file in a web browser.** You can now fill out the form and create events on your Google Calendar.


