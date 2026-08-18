import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

export type ContactEmailProps = {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string;
};

/**
 * The contact form arrives as a small Docket record: restrained paper colours,
 * mono labels and one accent stamp. Values remain text nodes so React escapes
 * whatever the sender typed before the email is rendered.
 */
export function ContactEmail({ name, email, subject, message, userId }: ContactEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${name} sent a message through Docket`}</Preview>
      <Body style={{ backgroundColor: "#DBD9D1", margin: 0, padding: "32px 12px" }}>
        <Container
          style={{
            maxWidth: "560px",
            backgroundColor: "#F7F6F2",
            border: "1px solid #C2BFB5",
            borderRadius: "3px",
            padding: "28px",
            fontFamily: "Helvetica, Arial, sans-serif",
            color: "#191A17",
          }}
        >
          <Text
            style={{
              display: "inline-block",
              margin: "0 0 18px",
              border: "2px solid #6C3FA8",
              borderRadius: "3px",
              boxShadow: "inset 0 0 0 1px #6C3FA8",
              padding: "6px 10px",
              color: "#6C3FA8",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
            }}
          >
            Docket · contact
          </Text>

          <Text style={{ margin: "0 0 22px", fontSize: "22px", fontWeight: 700, lineHeight: 1.25 }}>
            {subject}
          </Text>

          <Section style={{ borderTop: "1px solid #C2BFB5", borderBottom: "1px solid #C2BFB5" }}>
            <Detail label="Name" value={name} />
            <Detail label="Email" value={email} />
            {userId && <Detail label="Docket user" value={userId} />}
          </Section>

          <Text
            style={{
              margin: "22px 0 8px",
              color: "#5F5C54",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              letterSpacing: "1.4px",
              textTransform: "uppercase",
            }}
          >
            Message
          </Text>
          <Text style={{ margin: 0, fontSize: "15px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {message}
          </Text>

          <Hr style={{ borderColor: "#C2BFB5", margin: "24px 0 16px" }} />
          <Text
            style={{
              margin: 0,
              color: "#726F66",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            Replying to this email sends the response directly to {name}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ padding: "11px 0" }}>
      <Text
        style={{
          margin: "0 0 3px",
          color: "#5F5C54",
          fontFamily: "'Courier New', monospace",
          fontSize: "10px",
          letterSpacing: "1.3px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text style={{ margin: 0, fontSize: "14px", lineHeight: 1.4 }}>{value}</Text>
    </Section>
  );
}

export default ContactEmail;
