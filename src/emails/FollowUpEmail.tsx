import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type FollowUpItem = {
  protocolNumber: number;
  company: string;
  position: string;
  daysWaiting: number;
};

/**
 * The nudge. It states a fact and stops — no encouragement, no exclamation, no
 * advice about "staying positive". The reader is job hunting and already knows
 * how it is going; what they do not have is the list.
 *
 * Inline styles only, and a table-free layout: email clients strip stylesheets
 * and disagree about everything else.
 */
export function FollowUpEmail({
  items,
  days,
  settingsUrl,
  docketUrl,
}: {
  items: readonly FollowUpItem[];
  days: number;
  settingsUrl: string;
  docketUrl: string;
}) {
  const count = items.length;
  const heading =
    count === 1
      ? `One application has gone ${days} days without an answer.`
      : `${count} applications have gone ${days} days without an answer.`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{heading}</Preview>
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
              margin: "0 0 6px",
              fontSize: "11px",
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              color: "#6C3FA8",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Docket · follow-up
          </Text>

          <Text style={{ margin: "0 0 18px", fontSize: "20px", fontWeight: 700, lineHeight: 1.25 }}>
            {heading}
          </Text>

          <Section>
            {items.map((item) => (
              <Section
                key={item.protocolNumber}
                style={{ borderTop: "1px solid #C2BFB5", padding: "12px 0" }}
              >
                <Text style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
                  {item.company}
                </Text>
                <Text style={{ margin: "2px 0 0", fontSize: "14px", color: "#5F5C54" }}>
                  {item.position}
                </Text>
                <Text
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    color: "#5F5C54",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  Nº {String(item.protocolNumber).padStart(3, "0")} · {item.daysWaiting} days
                </Text>
              </Section>
            ))}
          </Section>

          <Hr style={{ borderColor: "#C2BFB5", margin: "20px 0" }} />

          <Text style={{ margin: 0, fontSize: "14px", color: "#5F5C54" }}>
            <Link href={docketUrl} style={{ color: "#6C3FA8" }}>
              Open your docket
            </Link>{" "}
            to move them along, or leave them where they are — the record keeps either way.
          </Text>

          <Text
            style={{
              margin: "18px 0 0",
              fontSize: "12px",
              color: "#726F66",
              fontFamily: "'Courier New', monospace",
            }}
          >
            One reminder per application, never a second.{" "}
            <Link href={settingsUrl} style={{ color: "#726F66" }}>
              Turn these off
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default FollowUpEmail;
