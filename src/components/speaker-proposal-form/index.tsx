import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import DatePicker from "@cloudscape-design/components/date-picker";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import Multiselect from "@cloudscape-design/components/multiselect";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { getIdToken } from "../../lib/auth";
import {
  getHCaptchaResponse,
  renderHCaptcha,
  resetHCaptcha,
} from "./hcaptcha-loader";
import "./styles.css";

interface Props {
  open: boolean;
  onClose: () => void;
  source: "home" | "awsug-panel";
}

type MultiselectOption = { label: string; value: string };

function defaultEarliestDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

function decodeTokenClaims(): { name?: string; email?: string } {
  try {
    const token = getIdToken();
    if (!token) return {};
    const parts = token.split(".");
    if (parts.length < 2) return {};
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4;
    if (pad) payload += "=".repeat(4 - pad);
    const claims = JSON.parse(atob(payload)) as Record<string, unknown>;
    return {
      name: typeof claims.name === "string" ? claims.name : undefined,
      email: typeof claims.email === "string" ? claims.email : undefined,
    };
  } catch {
    return {};
  }
}

const DAY_OPTIONS: MultiselectOption[] = [
  { value: "mon", label: "monday" },
  { value: "tue", label: "tuesday" },
  { value: "wed", label: "wednesday" },
  { value: "thu", label: "thursday" },
  { value: "fri", label: "friday" },
  { value: "sat", label: "saturday" },
  { value: "sun", label: "sunday" },
];

const TIME_OPTIONS: MultiselectOption[] = [
  { value: "morning", label: "morning" },
  { value: "afternoon", label: "afternoon" },
  { value: "evening", label: "evening" },
];

export default function SpeakerProposalForm({ open, onClose, source }: Props) {
  const { t } = useTranslation();
  const claims = useRef(decodeTokenClaims());

  const [name, setName] = useState(claims.current.name ?? "");
  const [email, setEmail] = useState(claims.current.email ?? "");
  const [topic, setTopic] = useState("");
  const [abstract, setAbstract] = useState("");
  const [format, setFormat] = useState("either");
  const [bioUrl, setBioUrl] = useState("");
  const [preferredDays, setPreferredDays] = useState<MultiselectOption[]>([]);
  const [preferredTimeOfDay, setPreferredTimeOfDay] = useState<
    MultiselectOption[]
  >([]);
  const [earliestDate, setEarliestDate] = useState(defaultEarliestDate());
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // refs for focus-first-error
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const abstractRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      void renderHCaptcha("speaker-cta-hcaptcha");
    }
  }, [open]);

  function resetForm() {
    const c = decodeTokenClaims();
    setName(c.name ?? "");
    setEmail(c.email ?? "");
    setTopic("");
    setAbstract("");
    setFormat("either");
    setBioUrl("");
    setPreferredDays([]);
    setPreferredTimeOfDay([]);
    setEarliestDate(defaultEarliestDate());
    setNotes("");
    setHoneypot("");
    setErrors({});
    setGlobalError("");
    setDone(false);
    resetHCaptcha();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("speakerForm.errors.validation");
    if (!email.trim()) next.email = t("speakerForm.errors.validation");
    if (!topic.trim()) next.topic = t("speakerForm.errors.validation");
    if (topic.length > 120) next.topic = t("speakerForm.errors.validation");
    if (!abstract.trim()) next.abstract = t("speakerForm.errors.validation");
    if (abstract.length > 1000) next.abstract = t("speakerForm.errors.validation");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // focus first invalid field
      if (next.name) nameRef.current?.focus();
      else if (next.email) emailRef.current?.focus();
      else if (next.topic) topicRef.current?.focus();
      else if (next.abstract) abstractRef.current?.focus();
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (honeypot) return; // honeypot triggered — silently drop

    setSubmitting(true);
    setGlobalError("");

    const hcaptchaToken = getHCaptchaResponse();
    const body = {
      name,
      email,
      topic,
      abstract,
      format,
      bioUrl: bioUrl || undefined,
      preferredDays: preferredDays.map((o) => o.value),
      preferredTimeOfDay: preferredTimeOfDay.map((o) => o.value),
      earliestDate,
      notes: notes || undefined,
      submittedFromUrl: window.location.href,
      website: honeypot,
      hcaptchaToken,
    };

    try {
      const endpoint = import.meta.env.VITE_SPEAKER_PROPOSAL_ENDPOINT as string;
      const idToken = getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      const res = await fetch(`${endpoint}/proposals`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        setDone(true);
        return;
      }

      if (res.status === 429) {
        setGlobalError(t("speakerForm.errors.rate"));
        resetHCaptcha();
        return;
      }

      if (res.status === 400) {
        let json: { error?: string; fields?: Record<string, string> } = {};
        try {
          json = (await res.json()) as typeof json;
        } catch {
          /* ignore */
        }
        if (json.error === "captcha_failed") {
          setGlobalError(t("speakerForm.errors.captcha"));
          resetHCaptcha();
          return;
        }
        if (json.fields) {
          setErrors(json.fields);
          return;
        }
        setGlobalError(t("speakerForm.errors.validation"));
        return;
      }

      setGlobalError(t("speakerForm.errors.network"));
    } catch {
      setGlobalError(t("speakerForm.errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Modal
        visible={open}
        onDismiss={handleClose}
        header={t("speakerForm.thankYouTitle")}
        footer={
          <Box float="right">
            <Button variant="primary" onClick={handleClose}>
              {t("speakerForm.thankYouClose")}
            </Button>
          </Box>
        }
      >
        <div className="spf-result" aria-live="polite">
          <p>{t("speakerForm.thankYouBody")}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      visible={open}
      onDismiss={handleClose}
      size="large"
      header={t("speakerForm.modalTitle")}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleClose} disabled={submitting}>
              {t("speakerForm.cancelButton")}
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {t("speakerForm.submitButton")}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {/* honeypot — visually hidden */}
      <div className="spf-honeypot" aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <Form errorText={globalError || undefined}>
        <SpaceBetween size="m">
          <FormField
            label={t("speakerForm.fields.name")}
            errorText={errors.name}
          >
            <Input
              ref={nameRef}
              value={name}
              onChange={({ detail }) => setName(detail.value)}
              placeholder={t("speakerForm.fields.name")}
            />
          </FormField>

          <FormField
            label={t("speakerForm.fields.email")}
            errorText={errors.email}
          >
            <Input
              ref={emailRef}
              value={email}
              type="email"
              onChange={({ detail }) => setEmail(detail.value)}
              placeholder="you@example.com"
            />
          </FormField>

          <FormField
            label={t("speakerForm.fields.topic")}
            errorText={errors.topic}
            description={t("speakerForm.helpers.topic")}
          >
            <Input
              ref={topicRef}
              value={topic}
              onChange={({ detail }) => setTopic(detail.value)}
              placeholder={t("speakerForm.fields.topic")}
            />
            <div
              className={`spf-char-counter${topic.length > 120 ? " spf-char-counter--over" : ""}`}
            >
              {topic.length}/120
            </div>
          </FormField>

          <FormField
            label={t("speakerForm.fields.abstract")}
            errorText={errors.abstract}
          >
            <Textarea
              ref={abstractRef}
              value={abstract}
              onChange={({ detail }) => setAbstract(detail.value)}
              rows={5}
              placeholder={t("speakerForm.fields.abstract")}
            />
            <div
              className={`spf-char-counter${abstract.length > 1000 ? " spf-char-counter--over" : ""}`}
            >
              {abstract.length}/1000
            </div>
          </FormField>

          <FormField label={t("speakerForm.fields.format")}>
            <RadioGroup
              value={format}
              onChange={({ detail }) => setFormat(detail.value)}
              items={[
                {
                  value: "in_person_west_tx_nm",
                  label: t("speakerForm.fields.format.in_person_west_tx_nm"),
                },
                {
                  value: "virtual",
                  label: t("speakerForm.fields.format.virtual"),
                },
                {
                  value: "either",
                  label: t("speakerForm.fields.format.either"),
                },
              ]}
            />
          </FormField>

          <FormField
            label={t("speakerForm.fields.bioUrl")}
            description={t("speakerForm.helpers.bioUrl")}
          >
            <Input
              value={bioUrl}
              type="url"
              onChange={({ detail }) => setBioUrl(detail.value)}
              placeholder="https://"
            />
          </FormField>

          <FormField label={t("speakerForm.fields.preferredDays")}>
            <Multiselect
              selectedOptions={preferredDays}
              onChange={({ detail }) =>
                setPreferredDays(
                  detail.selectedOptions as MultiselectOption[],
                )
              }
              options={DAY_OPTIONS}
              placeholder={t("speakerForm.fields.preferredDays")}
            />
          </FormField>

          <FormField label={t("speakerForm.fields.preferredTimeOfDay")}>
            <Multiselect
              selectedOptions={preferredTimeOfDay}
              onChange={({ detail }) =>
                setPreferredTimeOfDay(
                  detail.selectedOptions as MultiselectOption[],
                )
              }
              options={TIME_OPTIONS}
              placeholder={t("speakerForm.fields.preferredTimeOfDay")}
            />
          </FormField>

          <FormField
            label={t("speakerForm.fields.earliestDate")}
            description={t("speakerForm.helpers.earliestDate")}
          >
            <DatePicker
              value={earliestDate}
              onChange={({ detail }) => setEarliestDate(detail.value)}
              placeholder="YYYY/MM/DD"
            />
          </FormField>

          <FormField label={t("speakerForm.fields.notes")}>
            <Textarea
              value={notes}
              onChange={({ detail }) => setNotes(detail.value)}
              rows={3}
              placeholder={t("speakerForm.fields.notes")}
            />
          </FormField>

          <div className="spf-hcaptcha-wrap">
            <div id="speaker-cta-hcaptcha" />
          </div>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
