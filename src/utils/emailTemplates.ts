const getLogoUrl = () => "cid:sa-logo";

export function getBaseEmailTemplate(contentHtml: string): string {
  const logoUrl = getLogoUrl();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>S&A Dance Studio</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    body {
      margin: 0;
      padding: 0;
      font-family: Georgia, 'Times New Roman', serif;
      background-color: #FDFBFA;
      color: #222222;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #FDFBFA;
      padding: 40px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      background-color: #111111;
      text-align: center;
      padding: 40px 20px;
      border-bottom: 3px solid #D4A017;
    }
    .header img {
      max-width: 120px;
      height: auto;
      display: block;
      margin: 0 auto 20px auto;
    }
    .header h1 {
      margin: 0;
      color: #FFFFFF;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 36px;
      font-weight: normal;
      letter-spacing: 2px;
      line-height: 1.2;
    }
    .header .accent-text {
      color: #D4A017;
      font-style: italic;
    }
    .tagline {
      color: #F0C040;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-top: 15px;
      opacity: 0.9;
    }
    .content {
      padding: 40px 30px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #222222;
    }
    .content p {
      margin: 0 0 20px 0;
    }
    .message-box {
      background-color: #FDFBFA;
      border-left: 4px solid #E91E8C;
      padding: 20px;
      margin: 30px 0;
      border-radius: 0 8px 8px 0;
    }
    .footer {
      background-color: #111111;
      padding: 30px 20px;
      text-align: center;
      border-top: 1px solid #333333;
    }
    .footer h3 {
      margin: 0 0 10px 0;
      color: #FFFFFF;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-style: italic;
      font-weight: normal;
    }
    .footer p {
      margin: 0;
      color: #888888;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      letter-spacing: 1px;
    }
    .footer-accent {
      width: 40px;
      height: 2px;
      background-color: #E91E8C;
      margin: 15px auto;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="container" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td class="header">
          <img src="${logoUrl}" alt="S&A Logo">
          <h1>S&amp;A <br><span class="accent-text">Dance Studio</span></h1>
          <div class="tagline">Where Passion Meets Performance</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          ${contentHtml}
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin-bottom: 20px; color: #888888;">Regards,</p>
          <p style="font-weight: bold; color: #FFFFFF; font-size: 16px; margin: 0 0 5px 0;">Sandip Wasnik</p>
          <p style="color: #D4A017; font-size: 14px; margin: 0;">Founder, S&amp;A Dance Studio</p>
          
          <div class="footer-accent"></div>
          
          <h3>S&amp;A Dance Studio</h3>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

export function getStudentEmailTemplate(): string {
  const content = `
    <p>Hello <strong>{{name}}</strong>,</p>
    
    <div class="message-box">
      {{message}}
    </div>
  `;
  return getBaseEmailTemplate(content);
}
