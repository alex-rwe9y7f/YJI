const express = require('express');
const { google } = require('googleapis');
const serverless = require('serverless-http');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

app.get('/.netlify/functions/server/get-events', async (req, res) => {
    const { date } = req.query;
    const timeMin = new Date(date);
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + 1);

    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        res.json(response.data.items);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Failed to fetch events' });
    }
});

app.post('/.netlify/functions/server/create-event', async (req, res) => {
    const { title, startTime, endTime } = req.body;

    const event = {
        summary: title,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
    };

    try {
        // Check for conflicts first
        const existingEvents = await calendar.events.list({
            calendarId: 'primary',
            timeMin: event.start.dateTime,
            timeMax: event.end.dateTime,
            singleEvents: true,
        });

        if (existingEvents.data.items.length > 0) {
            const conflictDetails = { existingEvent: existingEvents.data.items[0], newRequest: event };
            res.status(409).json({ message: 'Time slot is already booked.', conflict: conflictDetails });
            return;
        }

        const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
        res.status(200).json({ message: 'Event created successfully', event: response.data });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Failed to create event' });
    }
});

app.post('/.netlify/functions/server/send-conflict-email', async (req, res) => {
    const { existingEvent, newRequest } = req.body;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'alleventis@gmail.com',
        subject: 'Booking Conflict Detected',
        html: `
            <p>A booking conflict has occurred.</p>
            <p><b>Existing Booking:</b></p>
            <p>Summary: ${existingEvent.summary}</p>
            <p>Start: ${new Date(existingEvent.start.dateTime).toLocaleString()}</p>
            <p>End: ${new Date(existingEvent.end.dateTime).toLocaleString()}</p>
            <p><b>New Request:</b></p>
            <p>Summary: ${newRequest.summary}</p>
            <p>Start: ${new Date(newRequest.start.dateTime).toLocaleString()}</p>
            <p>End: ${new Date(newRequest.end.dateTime).toLocaleString()}</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Conflict email sent' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Failed to send conflict email' });
    }
});

module.exports.handler = serverless(app);