require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { generatePoster } = require('./services/posterGenerator');
const templateRenders = {};

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/compliance_reminder';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve compiled React frontend statically
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000 // fail fast if Atlas is unreachable or IP is not whitelisted
})
  .then(() => {
    console.log('Connected to MongoDB successfully.');
    seedDatabase();
  })
  .catch(err => {
    console.error('\n========================================================================');
    console.error('❌ MONGODB CONNECTION ERROR');
    console.error('Could not connect to MongoDB database.');
    if (err.name === 'MongooseServerSelectionError') {
      console.error('\nThis is likely because your current IP address is not whitelisted in');
      console.error('your MongoDB Atlas cluster.');
      console.error('Please whitelist your current IP address in the MongoDB Atlas console:');
      console.error('https://cloud.mongodb.com/');
    }
    console.error('========================================================================\n');
    console.error(err.message || err);
  });

// ================= SCHEMAS & MODELS =================

// Settings Model
const SettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: String, required: true }
});
const Settings = mongoose.model('Settings', SettingsSchema);

const User = require('./models/User');
const Poster = require('./models/Poster');
const GeneratedPoster = require('./models/GeneratedPoster');
const CreditTransaction = require('./models/CreditTransaction');
const BulkRecipient = require('./models/BulkRecipient');

// Audit Log Model
const AuditLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now },
  ip_address: { type: String }
});
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

// Email Transporter for actual delivery
const transporter = nodemailer.createTransport({
  pool: true, // Use connection pooling to speed up delivery
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

// Mock Email logs stored in memory for frontend retrieval and debug pane
let emailLogs = [];

function logAndSendEmail(to, subject, body, attachment = null) {
  const isHtml = body.includes('<') && body.includes('>');
  if (!body.includes('growthpartners.in')) {
    if (isHtml) {
      body += '<br><br>---<br><a href="https://growthpartners.in/">Visit Website</a><br>Contact Us: +91 90199 46181<br><a href="https://www.linkedin.com/company/82536477">LinkedIn</a><br><a href="https://www.youtube.com/@GrowthPartners">YouTube</a>';
    } else {
      body += '\n\n---\nVisit Website\nContact Us: +91 90199 46181\nLinkedIn\nYouTube';
    }
  }
  const timestamp = new Date().toISOString();
  // Append a unique reference code to subject to prevent SMTP duplicate/spam throttling
  const uniqueSubject = subject;
  const mail = { to, subject: uniqueSubject, body, timestamp, attachment };
  emailLogs.unshift(mail);
  if (emailLogs.length > 50) emailLogs.pop(); // keep last 50

  console.log(`\n========================================`);
  console.log(`[EMAIL LOGGED] To: ${to}`);
  console.log(`Subject: ${uniqueSubject}`);
  console.log(`Body:\n${body}`);
  if (attachment) console.log(`[Attachment Attached]`);
  console.log(`========================================\n`);

  // Send the email asynchronously in the next tick to prevent blocking the HTTP response thread
  setImmediate(() => {
    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      const mailOptions = {
        from: `"Growth Partners" <${process.env.SMTP_EMAIL}>`,
        to: to,
        subject: uniqueSubject,
      };

      if (isHtml) {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      if (attachment) {
        let content = attachment;
        let encoding = undefined;
        let filename = 'report.pdf';

        if (typeof attachment === 'string') {
          content = attachment.split(',')[1] || attachment;
          encoding = 'base64';
          filename = 'poster.jpg';
        }

        mailOptions.attachments = [{
          filename: filename,
          content: content,
          encoding: encoding
        }];
      }

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('SMTP Send Error:', error);
        } else {
          console.log('Real Email sent: ' + info.response);
        }
      });
    } else {
      console.log('SMTP credentials not configured in .env. Skipping real email dispatch.');
    }
  });
}

// Database Seeder
async function seedDatabase() {
  try {
    // 1. Settings
    const hasTrialCredits = await Settings.findOne({ key: 'trial_credits' });
    if (!hasTrialCredits) {
      await Settings.create([
        { key: 'trial_credits', value: '20' },
        { key: 'trial_days', value: '15' },
        { key: 'whatsapp_support', value: '919876543210' }
      ]);
      console.log('Seeded Settings constants.');
    }

    // 2. Users
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      // Admin
      await User.create({
        username: 'admin',
        password: 'admin123',
        name: 'Administrator',
        email: 'admin@growthpartners.in',
        phone: '9999999999',
        role: 'admin',
        credits: 9999,
        expiry_date: '2099-12-31',
        profile_completion: 100.0
      });
      console.log('Seeded admin user account.');
    }

    const demoCaExists = await User.findOne({ username: 'demo_ca' });
    if (!demoCaExists) {
      // Test practitioner
      const trialDays = 15;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + trialDays);
      const expiryStr = expiry.toISOString().split('T')[0];

      await User.create({
        username: 'demo_ca',
        password: 'password123',
        name: 'Sudha CA & Co.',
        email: 'sudha@gmail.com',
        phone: '9876543210',
        role: 'user',
        credits: 20,
        expiry_date: expiryStr,
        profile_completion: 100.0,
        city: 'Chennai',
        address: '123 Mount Road, Anna Salai',
        firm_logo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%230b1c30"/><text x="50%" y="55%" font-family="sans-serif" font-size="20" fill="%23f8f9ff" text-anchor="middle">GP CO</text></svg>'
      });
      console.log('Seeded demo_ca user account.');
    }

    // 3. Posters
    const posterCount = await Poster.countDocuments();
    if (posterCount === 0) {
      await Poster.create([
        { month: 'July', category: 'Compliance Calendar', title: 'Navy & Orange Timeline', image_url: 'calendar_modern', description: 'Premium timeline infographic with Navy blue and Orange accents.' },
        { month: 'July', category: 'Compliance Calendar', title: 'Purple & Gold Luxury', image_url: 'calendar_timeline', description: 'Elegant horizontal cards with Purple and Gold theme.' },
        { month: 'July', category: 'Compliance Calendar', title: 'Dark Emerald Mode', image_url: 'calendar_grid', description: 'Sleek dark mode with glowing Emerald accents and glass cards.' },
        { month: 'July', category: 'Compliance Calendar', title: 'Coral & Cream Grid', image_url: 'calendar_minimal', description: 'Warm 2-column grid layout with Coral and Cream colors.' },
        { month: 'July', category: 'Design Template', title: 'Neon Glassmorphism', image_url: 'calendar_dashboard', description: 'Neon glassmorphism UI/UX themed layout.' }
      ]);
      console.log('Seeded poster catalog items.');
    } else {
      await Poster.updateOne({ image_url: 'calendar_dashboard' }, { title: 'Neon Glassmorphism' });
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

// Log audit helper
async function logAudit(userId, action, details, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    await AuditLog.create({
      user_id: userId,
      action,
      details,
      ip_address: ip
    });
  } catch (err) {
    console.error('Audit log failure:', err);
  }
}

// ================= AUTH ROUTES =================
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, email, phone } = req.body;
  if (!username || !password || !name || !email || !phone) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const activeCreditsSetting = await Settings.findOne({ key: 'trial_credits' });
    const activeDaysSetting = await Settings.findOne({ key: 'trial_days' });

    const trialCredits = parseInt(activeCreditsSetting?.value || '20', 10);
    const trialDays = parseInt(activeDaysSetting?.value || '15', 10);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + trialDays);
    const expiryStr = expiry.toISOString().split('T')[0];

    const user = await User.create({
      username,
      password,
      name,
      email,
      phone,
      credits: trialCredits,
      expiry_date: expiryStr,
      profile_completion: 33.3 // Initial completion (fields: username, email, phone filled)
    });

    // Log credit transaction
    await CreditTransaction.create({
      user_id: user._id,
      credit_change: trialCredits,
      transaction_type: 'Welcome Bonus'
    });

    const day = String(expiry.getDate()).padStart(2, '0');
    const m = String(expiry.getMonth() + 1).padStart(2, '0');
    const y = String(expiry.getFullYear()).slice(-2);
    const expiryFormatted = `${day}-${m}-${y}`;

    // Send welcome email
    logAndSendEmail(
      email,
      'Welcome to Growth Partners Personalisation Tool!',
      `Hi ${name},\n\nThank you for registering! Your account has been created successfully.\n\nLogin Details:\nUsername: ${username}\nPassword: ${password}\n\nFree Trial Credits: ${trialCredits}\nExpiry Date: ${expiryFormatted}\n\nStart personalizing your compliance posters now!\n\nContact Number: +91 90199 46181\nWebsite: https://growthpartners.in/\nYouTube: https://www.youtube.com/@GrowthPartners\nLinkedIn: https://www.linkedin.com/company/82536477/`
    );

    await logAudit(user._id, 'USER_REGISTER', `Registered user with username: ${username}`, req);

    res.json({ success: true, message: 'Registration successful! 20 free credits have been added to your account.' });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      if (error.errmsg.includes('username')) {
        return res.status(400).json({ error: 'Username already exists.' });
      }
      if (error.errmsg.includes('email')) {
        return res.status(400).json({ error: 'Email already exists.' });
      }
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Email/Username and password required.' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ],
      password
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email/username or password.' });
    }

    if (user.role !== 'admin' && user.is_active === 0) {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact support.' });
    }

    await logAudit(user._id, 'USER_LOGIN', `Logged in successfully`, req);

    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      credits: user.credits,
      expiry_date: user.expiry_date,
      profile_completion: user.profile_completion,
      firm_logo: user.firm_logo,
      address: user.address,
      city: user.city
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User with this email does not exist.' });

    // Generate a secure reset token
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    user.resetToken = token;
    await user.save();

    // Determine client host
    const clientHost = req.headers.referer || 'http://localhost:5173/';
    const baseUrl = new URL(clientHost).origin;
    const resetLink = `${baseUrl}/#/reset?token=${token}`;

    logAndSendEmail(
      email,
      'Reset Your Password',
      `Hi ${user.name},\n\nPlease click the link below to reset your password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.`
    );

    await logAudit(user._id, 'PASSWORD_RECOVERY_REQUEST', `Requested password recovery for email: ${email}`, req);
    res.json({
      success: true,
      message: 'A password reset link has been sent to your registered email logs.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }
  try {
    const user = await User.findOne({ resetToken: token });
    if (!user) return res.status(400).json({ error: 'Invalid or expired password reset link.' });

    user.password = new_password;
    user.resetToken = undefined;
    await user.save();

    logAndSendEmail(
      user.email,
      'Password Updated Successfully',
      `Hi ${user.name},\n\nYour password has been successfully updated.\n\nYou can now sign in using your new password.`
    );

    await logAudit(user._id, 'PASSWORD_RESET_COMPLETE', `Successfully set new password`, req);
    res.json({ success: true, message: 'Password updated successfully. Please login with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ================= USER FLOW API =================
app.get('/api/user/profile/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      credits: user.credits,
      expiry_date: user.expiry_date,
      profile_completion: user.profile_completion,
      firm_logo: user.firm_logo,
      address: user.address,
      city: user.city
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/profile/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, email, phone, firm_logo, address, city } = req.body;

  try {
    // Calculate profile completion percentage (6 fields)
    const fields = [name, email, phone, firm_logo, address, city];
    const filledCount = fields.filter(f => f && f.toString().trim() !== '').length;
    const completionPercent = Math.round((filledCount / fields.length) * 100);

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user just reached 100% and hasn't been rewarded yet
    let newCredits = user.credits;
    if (completionPercent === 100) {
      const CreditTransaction = require('./models/CreditTransaction');
      const existingBonus = await CreditTransaction.findOne({
        user_id: userId,
        transaction_type: 'Profile Completion Bonus'
      });
      if (!existingBonus) {
        newCredits += 10;
        await CreditTransaction.create({
          user_id: userId,
          credit_change: 10,
          transaction_type: 'Profile Completion Bonus'
        });

        // Notify user about the bonus credits
        logAndSendEmail(
          email,
          'Profile Complete - 10 Bonus Credits Awarded!',
          `Hi ${name},\n\nCongratulations on completing your firm profile!\n\nAs a reward, we have added 10 free credits to your account. You can use these to personalize and download more compliance posters.\n\nCurrent Credit Balance: ${newCredits}\n\nStart generating now!`
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, {
      name, email, phone, firm_logo, address, city,
      profile_completion: completionPercent,
      credits: newCredits
    }, { new: true });

    // Send generic profile update email to prove SMTP is working
    logAndSendEmail(
      email,
      'Your Firm Profile has been updated',
      `Hi ${name},\n\nYour professional firm profile details have been successfully updated in the system.\n\nChanges made to your branding fields will automatically reflect on all your future compliance posters.`
    );

    await logAudit(userId, 'PROFILE_UPDATE', `Updated profile settings. Completion: ${completionPercent}%`, req);

    res.json({
      success: true,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        credits: updatedUser.credits,
        expiry_date: updatedUser.expiry_date,
        profile_completion: updatedUser.profile_completion,
        firm_logo: updatedUser.firm_logo,
        address: updatedUser.address,
        city: updatedUser.city
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.get('/api/posters', async (req, res) => {
  try {
    const { month } = req.query;
    const query = month ? { month } : {};
    const posters = await Poster.find(query).sort({ createdAt: 1 });

    // Only valid renderable template keys, deduplicated
    const validKeys = new Set(Object.keys(templateRenders));
    const seen = new Set();
    const unique = posters.filter(p => {
      if (!validKeys.has(p.image_url) && p.image_url !== 'custom_uploaded') return false;
      if (seen.has(p.image_url)) return false;
      seen.add(p.image_url);
      return true;
    });

    res.json(unique.map(p => ({
      id: p._id,
      month: p.month,
      category: p.category,
      title: p.title,
      image_url: p.image_url,
      description: p.description
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/templates', (req, res) => {
  res.json(templateRenders);
});

// Real thumbnail: renders the actual Fabric.js poster with placeholder data or user data if userId is provided
app.get('/api/templates/thumbnail/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { month, userId } = req.query;
    let poster = { image_url: key, month: month || 'July' };

    if (key === 'custom_uploaded') {
      const dbPoster = await Poster.findOne({ image_url: 'custom_uploaded', month: poster.month });
      if (dbPoster) {
        poster = dbPoster;
      }
    }

    let targetUser = {
      name: 'Your Firm Name',
      address: 'Your City, State',
      phone: '+91 99999 99999',
      email: 'yourfirm@email.com',
      firm_logo: null
    };

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        targetUser = user.toObject();
      }
    }

    // Pass month explicitly as override so it's never lost
    const imageBuffer = await generatePoster(targetUser, poster, null, month || 'July');
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-store');
    res.send(imageBuffer);
  } catch (err) {
    console.error('Thumbnail error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/posters/custom', async (req, res) => {
  try {
    const { customImageBase64, month, category, title } = req.body;
    if (!customImageBase64 || !month) return res.status(400).json({ error: 'Missing image or month.' });

    let poster = await Poster.findOne({ image_url: 'custom_uploaded', month });
    if (!poster) {
      poster = new Poster({
        image_url: 'custom_uploaded',
        month,
        category: category || 'Custom Campaign',
        title: title || 'Campaign Poster',
        description: 'Uploaded custom campaign poster background.',
        footer: {
          x: 15,
          y: 1295,
          width: 910,
          height: 370
        }
      });
    }
    poster.custom_image_base64 = customImageBase64;
    poster.month = month;
    poster.title = title || poster.title;
    poster.category = category || poster.category;
    if (!poster.footer || !poster.footer.y || poster.footer.y === 1087) {
      poster.footer = {
        x: 15,
        y: 1295,
        width: 910,
        height: 370
      };
    }
    await poster.save();

    res.json({ message: 'Custom poster uploaded successfully', poster });
  } catch (error) {
    console.error('Custom poster upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posters/generate', async (req, res) => {
  const { user_id, poster_id, poster_title, theme, fields, logoBase64, month } = req.body;
  if (!user_id || !poster_id) return res.status(400).json({ error: 'Missing required parameters.' });

  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.credits < 1) return res.status(400).json({ error: 'Insufficient credits.' });

    // Enforce expiry check
    if (user.expiry_date) {
      const isExpired = new Date(user.expiry_date) < new Date();
      if (isExpired) return res.status(403).json({ error: 'Account expired. Please contact support.' });
    }

    const poster = await Poster.findById(poster_id);
    if (!poster) return res.status(404).json({ error: 'Poster not found.' });

    // Inject temporary live editor fields for final generation
    const finalUser = {
      ...user.toObject(),
      name: fields?.name || user.name,
      address: fields?.address || user.address,
      city: fields?.city || user.city,
      phone: fields?.phone || user.phone,
      email: fields?.email || user.email,
      firm_logo: logoBase64 !== undefined ? logoBase64 : user.firm_logo
    };

    // Generate Poster via Canvas (Server-side)
    const imageBuffer = await generatePoster(finalUser, poster, theme || 'light', month);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // Deduct credit
    user.credits -= 1;
    await user.save();

    const downloadUrl = `posters/generated_${user_id}_${Date.now()}.jpg`;

    // Record history
    await GeneratedPoster.create({
      user_id: user._id,
      poster_id: poster._id,
      download_url: downloadUrl
    });

    // Record credit transaction
    await CreditTransaction.create({
      user_id: user._id,
      credit_change: -1,
      transaction_type: 'Poster Generation'
    });

    await logAudit(user._id, 'POSTER_GENERATE', `Generated poster: ${poster_title || poster_id}`, req);

    res.json({
      success: true,
      remaining_credits: user.credits,
      download_url: downloadUrl,
      generated_date: new Date().toISOString(),
      image_data: base64Image
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posters/send-email', async (req, res) => {
  const { user_id, poster_title, poster_description, image_data } = req.body;
  if (!user_id || !image_data) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    logAndSendEmail(
      user.email,
      `Poster Generated Successfully - GP Personalisation Tool`,
      `Hi ${user.name},\n\nYou have successfully generated the compliance poster:\n\nTitle: ${poster_title || 'Compliance Poster'}\nDescription: ${poster_description || 'N/A'}\n\nCredit Balance Details:\n- 1 credit has been deducted.\n- Remaining Credits: ${user.credits}\n\nYou can view and download your history at any time on your dashboard.`,
      image_data
    );

    res.json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posters/preview', async (req, res) => {
  const { user_id, poster_id, theme, fields, logoBase64, month } = req.body;
  if (!user_id || !poster_id) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const poster = await Poster.findById(poster_id);
    if (!poster) return res.status(404).json({ error: 'Poster not found.' });

    // Inject temporary live editor fields for preview without saving to DB
    const previewUser = {
      ...user.toObject(),
      name: fields.name || user.name,
      address: fields.address || user.address,
      city: fields.city || user.city,
      phone: fields.phone || user.phone,
      email: fields.email || user.email,
      firm_logo: logoBase64 !== undefined ? logoBase64 : user.firm_logo
    };

    const imageBuffer = await generatePoster(previewUser, poster, theme || 'light', month);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    res.json({ image_data: base64Image });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/history/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const genLogs = await GeneratedPoster.find({ user_id: userId }).populate('poster_id');
    const txLogs = await CreditTransaction.find({ user_id: userId });

    const history = [];

    genLogs.forEach(g => {
      history.push({
        type: 'generation',
        date: g.generated_date,
        description: g.poster_id?.title || 'Personalized Poster',
        change_amt: -g.credits_used
      });
    });

    txLogs.forEach(t => {
      if (t.transaction_type !== 'Poster Generation') {
        history.push({
          type: 'transaction',
          date: t.date,
          description: t.transaction_type,
          change_amt: t.credit_change
        });
      }
    });

    // Sort descending
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Admin Routes ──────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: 'admin-auth-token-123' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.get('/api/admin/activity', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== 'Bearer admin-auth-token-123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const activity = await GeneratedPoster.find()
      .populate('user_id', 'name email firm_name')
      .populate('poster_id', 'title category image_url')
      .sort({ generated_date: -1 })
      .lean();

    const formattedActivity = activity.map(log => ({
      id: log._id,
      user_name: log.user_id ? log.user_id.name : 'Unknown User',
      user_email: log.user_id ? log.user_id.email : 'N/A',
      user_id: log.user_id ? log.user_id._id : null,
      poster_title: log.poster_id ? log.poster_id.title : 'Deleted Template',
      poster_image: log.poster_id ? log.poster_id.image_url : null,
      generated_date: log.generated_date,
      credits_used: log.credits_used
    }));

    res.json({ success: true, data: formattedActivity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/campaign-template', async (req, res) => {
  try {
    const subject = await Settings.findOne({ key: 'campaign_subject' });
    const body = await Settings.findOne({ key: 'campaign_body' });
    res.json({
      subject: subject ? subject.value : null,
      body: body ? body.value : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/campaign-template', async (req, res) => {
  try {
    const { subject, body } = req.body;
    await Settings.updateOne({ key: 'campaign_subject' }, { value: subject }, { upsert: true });
    await Settings.updateOne({ key: 'campaign_body' }, { value: body }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN API =================
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find();

    const mapped = users.map(u => ({
      id: u._id,
      username: u.username,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      credits: u.credits,
      expiry_date: u.expiry_date,
      is_active: u.is_active,
      profile_completion: u.profile_completion
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/users/:id/credits', async (req, res) => {
  const userId = req.params.id;
  const { amount, action } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let change = parseInt(amount, 10);
    if (action === 'deduct') change = -change;

    user.credits = Math.max(0, user.credits + change);
    await user.save();

    // Log transaction
    await CreditTransaction.create({
      user_id: user._id,
      credit_change: change,
      transaction_type: `Admin Adjustment (${action})`
    });

    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_CREDIT_ADJUST', `Adjusted user ${userId} credits by ${change}. New: ${user.credits}`, req);

    logAndSendEmail(
      user.email,
      'Account Credit Balance Updated',
      `Hi ${user.name},\n\nYour credit balance has been updated by the administrator.\n\nAdjustment: ${change > 0 ? '+' : ''}${change}\nNew Credit Balance: ${user.credits}\n\nThank you for choosing Growth Partners.`
    );

    res.json({ success: true, credits: user.credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/users/:id/status', async (req, res) => {
  const userId = req.params.id;
  const { is_active } = req.body;

  try {
    await User.findByIdAndUpdate(userId, { is_active });
    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_USER_STATUS', `Toggled user ${userId} active status to ${is_active}`, req);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  const userId = req.params.id;
  const { new_password } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.password = new_password;
    await user.save();

    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_USER_PASSWORD_RESET', `Reset user ${userId} password`, req);

    logAndSendEmail(
      user.email,
      'Password Reset Notice - GP Personalisation Tool',
      `Hi ${user.name},\n\nYour login password has been reset by the administrator.\n\nNew Temporary Password: ${new_password}\n\nPlease change this password after your next login.`
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/reports', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activeUsers = await User.countDocuments({ role: 'user', is_active: 1 });
    const totalGenerated = await GeneratedPoster.countDocuments();
    const consumedResult = await GeneratedPoster.aggregate([{ $group: { _id: null, total: { $sum: '$credits_used' } } }]);
    const totalCreditsConsumed = consumedResult[0]?.total || 0;

    // Monthly generation stats (aggregation)
    const monthlyStatsResult = await GeneratedPoster.aggregate([
      {
        $lookup: {
          from: 'posters',
          localField: 'poster_id',
          foreignField: '_id',
          as: 'poster'
        }
      },
      { $unwind: '$poster' },
      {
        $group: {
          _id: '$poster.month',
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyStats = monthlyStatsResult.map(m => ({
      month: m._id,
      count: m.count
    }));

    res.json({
      totalUsers,
      activeUsers,
      totalGenerated,
      totalCreditsConsumed,
      monthlyStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().populate('user_id').sort({ timestamp: -1 }).limit(100);

    const mapped = logs.map(l => ({
      id: l._id,
      timestamp: l.timestamp,
      username: l.user_id?.username,
      user_id: l.user_id?._id,
      action: l.action,
      details: l.details,
      ip_address: l.ip_address
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/posters', async (req, res) => {
  const { month, category, title, image_url, description } = req.body;
  if (!month || !category || !title || !image_url) {
    return res.status(400).json({ error: 'Month, category, title, and image_url are required.' });
  }
  try {
    const poster = await Poster.create({ month, category, title, image_url, description });
    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_POSTER_CREATE', `Uploaded new poster: ${title} (${month})`, req);
    res.json({ success: true, id: poster._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/posters/:id', async (req, res) => {
  const posterId = req.params.id;
  try {
    await Poster.findByIdAndDelete(posterId);
    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_POSTER_DELETE', `Deleted poster ID ${posterId}`, req);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const trialCredits = await Settings.findOne({ key: 'trial_credits' });
    const trialDays = await Settings.findOne({ key: 'trial_days' });
    const whatsappSupport = await Settings.findOne({ key: 'whatsapp_support' });

    res.json({
      trial_credits: trialCredits?.value || '20',
      trial_days: trialDays?.value || '15',
      whatsapp_support: whatsappSupport?.value || '919876543210'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  const { trial_credits, trial_days, whatsapp_support } = req.body;
  try {
    await Settings.findOneAndUpdate({ key: 'trial_credits' }, { value: trial_credits.toString() }, { upsert: true });
    await Settings.findOneAndUpdate({ key: 'trial_days' }, { value: trial_days.toString() }, { upsert: true });
    await Settings.findOneAndUpdate({ key: 'whatsapp_support' }, { value: whatsapp_support.toString() }, { upsert: true });

    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_SETTINGS_UPDATE', `Updated system settings`, req);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/send-announcement', async (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and Body are required.' });
  }
  try {
    const users = await User.find({ role: 'user' });
    for (const user of users) {
      logAndSendEmail(
        user.email,
        `[Admin Update] ${subject}`,
        `Hi ${user.name},\n\n${body}\n\nBest regards,\nAdministration Team`
      );
    }
    await logAudit(new mongoose.Types.ObjectId(), 'ADMIN_ANNOUNCEMENT_SENT', `Sent announcement: ${subject} to ${users.length} users`, req);
    res.json({ success: true, message: `Announcement sent to ${users.length} users successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= BULK EMAIL CAMPAIGN ROUTES =================
app.get('/api/admin/bulk-recipients', async (req, res) => {
  try {
    const recipients = await BulkRecipient.find().sort({ createdAt: -1 });
    res.json(recipients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/bulk-recipients', async (req, res) => {
  const { recipients } = req.body;
  if (!Array.isArray(recipients)) {
    return res.status(400).json({ error: 'Recipients array is required.' });
  }

  try {
    await BulkRecipient.deleteMany({});
    const saved = await BulkRecipient.insertMany(recipients);
    res.json({ success: true, count: saved.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/bulk-recipients', async (req, res) => {
  try {
    await BulkRecipient.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/bulk-recipients/send', async (req, res) => {
  const { posterId, month, theme, subjectTemplate, bodyTemplate } = req.body;
  if (!posterId || !month || !subjectTemplate || !bodyTemplate) {
    return res.status(400).json({ error: 'Missing posterId, month, subjectTemplate, or bodyTemplate.' });
  }

  try {
    const poster = await Poster.findById(posterId);
    if (!poster) return res.status(404).json({ error: 'Poster layout not found.' });

    const recipients = await BulkRecipient.find({ status: { $ne: 'Sent' } });
    if (recipients.length === 0) {
      return res.json({ success: true, message: 'No pending recipients found.' });
    }

    res.json({ success: true, message: `Started bulk campaign for ${recipients.length} recipients.` });

    setImmediate(async () => {
      for (const recipient of recipients) {
        recipient.status = 'Sending';
        await recipient.save();

        try {
          if (!recipient.email) {
            throw new Error('No email address provided for this recipient.');
          }
          const userData = {
            name: recipient.name,
            email: recipient.email,
            firm_name: recipient.firm_name,
            phone: recipient.phone,
            city: recipient.city,
            address: recipient.address,
            firm_logo: recipient.firm_logo
          };
          console.log('[BulkSend] Generating for recipient:', { name: recipient.name, firm_name: recipient.firm_name, phone: recipient.phone, email: recipient.email, city: recipient.city });
          console.log('[BulkSend] Poster:', { id: poster._id, image_url: poster.image_url, has_base64: !!(poster.custom_image_base64) });

          const imageBuffer = await generatePoster(userData, poster, theme || 'light', month);
          const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

          const subject = subjectTemplate
            .replace(/{name}/g, recipient.name || '')
            .replace(/{email}/g, recipient.email || '')
            .replace(/{firm_name}/g, recipient.firm_name || '')
            .replace(/{phone}/g, recipient.phone || '')
            .replace(/{city}/g, recipient.city || '')
            .replace(/{month}/g, month || 'July');

          let body = bodyTemplate
            .replace(/{name}/g, recipient.name || '')
            .replace(/{email}/g, recipient.email || '')
            .replace(/{firm_name}/g, recipient.firm_name || '')
            .replace(/{phone}/g, recipient.phone || '')
            .replace(/{city}/g, recipient.city || '')
            .replace(/{month}/g, month || 'July');

          const isHtml = body.includes('<') && body.includes('>');
          if (!body.includes('growthpartners.in')) {
            if (isHtml) {
              body += '<br><br>---<br><a href="https://growthpartners.in/">Visit Website</a><br>Contact Us: +91 90199 46181<br><a href="https://www.linkedin.com/company/82536477">LinkedIn</a><br><a href="https://www.youtube.com/@GrowthPartners">YouTube</a>';
            } else {
              body += '\n\n---\nVisit Website\nContact Us: +91 90199 46181\nLinkedIn\nYouTube';
            }
          }

          const timestamp = new Date().toISOString();
          const uniqueSubject = subject;

          emailLogs.unshift({
            to: recipient.email,
            subject: uniqueSubject,
            body: body,
            timestamp: timestamp,
            attachment: base64Image
          });
          if (emailLogs.length > 50) emailLogs.pop();

          if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
            const mailOptions = {
              from: `"Growth Partners" <${process.env.SMTP_EMAIL}>`,
              to: recipient.email,
              subject: uniqueSubject,
              attachments: [{
                filename: `${poster.title.replace(/[^a-z0-9\s]/gi, '_').trim()}.jpg`,
                content: imageBuffer
              }]
            };
            if (isHtml) {
              mailOptions.html = body;
            } else {
              mailOptions.text = body;
            }

            await new Promise((resolve, reject) => {
              transporter.sendMail(mailOptions, (error, info) => {
                if (error) reject(error);
                else resolve(info);
              });
            });
          }

          recipient.status = 'Sent';
          recipient.sentAt = new Date();
          recipient.error = undefined;
          await recipient.save();

        } catch (err) {
          console.error(`Failed to send bulk email to ${recipient.email}:`, err);
          recipient.status = 'Failed';
          recipient.error = err.message;
          await recipient.save();
        }
      }
    });

  } catch (error) {
    console.error('Bulk send campaign failure:', error);
  }
});

app.post('/api/admin/bulk-recipients/:id/send', async (req, res) => {
  const recipientId = req.params.id;
  const { posterId, month, theme, subjectTemplate, bodyTemplate } = req.body;
  if (!posterId || !month || !subjectTemplate || !bodyTemplate) {
    return res.status(400).json({ error: 'Missing required configuration parameters.' });
  }

  try {
    const poster = await Poster.findById(posterId);
    if (!poster) return res.status(404).json({ error: 'Poster layout not found.' });

    const recipient = await BulkRecipient.findById(recipientId);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found.' });

    if (!recipient.email) {
      return res.status(400).json({ error: 'No email address provided for this recipient.' });
    }

    recipient.status = 'Sending';
    await recipient.save();

    res.json({ success: true, message: `Sending campaign to ${recipient.email}.` });

    setImmediate(async () => {
      try {
        const userData = {
          name: recipient.name,
          email: recipient.email,
          firm_name: recipient.firm_name,
          phone: recipient.phone,
          city: recipient.city,
          address: recipient.address,
          firm_logo: recipient.firm_logo
        };
        console.log('[SingleSend] Generating for recipient:', { name: recipient.name, firm_name: recipient.firm_name, phone: recipient.phone, email: recipient.email, city: recipient.city });
        console.log('[SingleSend] Poster:', { id: poster._id, image_url: poster.image_url, has_base64: !!(poster.custom_image_base64) });

        const imageBuffer = await generatePoster(userData, poster, theme || 'light', month);
        const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

        const subject = subjectTemplate
          .replace(/{name}/g, recipient.name || '')
          .replace(/{email}/g, recipient.email || '')
          .replace(/{firm_name}/g, recipient.firm_name || '')
          .replace(/{phone}/g, recipient.phone || '')
          .replace(/{city}/g, recipient.city || '')
          .replace(/{month}/g, month || 'July');

        let body = bodyTemplate
          .replace(/{name}/g, recipient.name || '')
          .replace(/{email}/g, recipient.email || '')
          .replace(/{firm_name}/g, recipient.firm_name || '')
          .replace(/{phone}/g, recipient.phone || '')
          .replace(/{city}/g, recipient.city || '')
          .replace(/{month}/g, month || 'July');

        const isHtml = body.includes('<') && body.includes('>');
        if (!body.includes('growthpartners.in')) {
          if (isHtml) {
            body += '<br><br>---<br><a href="https://growthpartners.in/">Visit Website</a><br>Contact Us: +91 90199 46181<br><a href="https://www.linkedin.com/company/82536477">LinkedIn</a><br><a href="https://www.youtube.com/@GrowthPartners">YouTube</a>';
          } else {
            body += '\n\n---\nVisit Website\nContact Us: +91 90199 46181\nLinkedIn\nYouTube';
          }
        }

        const timestamp = new Date().toISOString();
        const uniqueSubject = subject;

        emailLogs.unshift({
          to: recipient.email,
          subject: uniqueSubject,
          body: body,
          timestamp: timestamp,
          attachment: base64Image
        });
        if (emailLogs.length > 50) emailLogs.pop();

        if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
          const mailOptions = {
            from: `"Growth Partners" <${process.env.SMTP_EMAIL}>`,
            to: recipient.email,
            subject: uniqueSubject,
            attachments: [{
              filename: `${poster.title.replace(/[^a-z0-9\s]/gi, '_').trim()}.jpg`,
              content: imageBuffer
            }]
          };
          if (isHtml) {
            mailOptions.html = body;
          } else {
            mailOptions.text = body;
          }

          await new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) reject(error);
              else resolve(info);
            });
          });
        }

        recipient.status = 'Sent';
        recipient.sentAt = new Date();
        recipient.error = undefined;
        await recipient.save();

      } catch (err) {
        console.error(`Failed to send bulk email to ${recipient.email}:`, err);
        recipient.status = 'Failed';
        recipient.error = err.message;
        await recipient.save();
      }
    });

  } catch (error) {
    console.error('Single send campaign failure:', error);
  }
});


app.get('/api/debug/emails', (req, res) => {
  const filtered = emailLogs.filter(mail =>
    !mail.subject.includes('Reset Your Password') &&
    !mail.subject.includes('Password Updated Successfully') &&
    !mail.subject.includes('Welcome to Growth Partners')
  );
  res.json(filtered);
});

// Fallback for React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
