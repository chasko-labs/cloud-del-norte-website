import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { type Proposal, listProposals, patchProposal } from "../../../lib/admin";

const STATUS_OPTIONS = [
  { value: "pending", label: "pending" },
  { value: "contacted", label: "contacted" },
  { value: "scheduled", label: "scheduled" },
  { value: "completed", label: "completed" },
  { value: "declined", label: "declined" },
];

const STATUS_TYPE: Record<
  Proposal["status"],
  "success" | "warning" | "error" | "info" | "stopped"
> = {
  pending: "info",
  contacted: "warning",
  scheduled: "warning",
  completed: "success",
  declined: "stopped",
};

export default function SpeakerProposalsAdminTable() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Proposal["status"]>("pending");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingIds, setActingIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (status: Proposal["status"]) => {
      setLoading(true);
      setError(null);
      try {
        setProposals(await listProposals(status));
      } catch (err) {
        setError(err instanceof Error ? err.message : "unknown error");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const markContacted = useCallback(async (id: string) => {
    setActingIds((prev) => new Set(prev).add(id));
    try {
      await patchProposal(id, { status: "contacted" });
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "patch failed");
    } finally {
      setActingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  return (
    <SpaceBetween size="m">
      {error && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      <Table
        loading={loading}
        loadingText={t("admin.proposals.loadingText")}
        items={proposals}
        columnDefinitions={[
          {
            id: "submitted",
            header: t("admin.proposals.columnSubmitted"),
            cell: (p) => new Date(p.createdAt).toLocaleDateString(),
          },
          {
            id: "name",
            header: t("admin.proposals.columnName"),
            cell: (p) => p.name,
            isRowHeader: true,
          },
          {
            id: "topic",
            header: t("admin.proposals.columnTopic"),
            cell: (p) => p.topic,
          },
          {
            id: "format",
            header: t("admin.proposals.columnFormat"),
            cell: (p) => t(`admin.proposals.status.${p.format}` as Parameters<typeof t>[0]) || p.format,
          },
          {
            id: "earliestDate",
            header: t("admin.proposals.columnEarliestDate"),
            cell: (p) => p.earliestDate,
          },
          {
            id: "status",
            header: t("admin.proposals.columnStatus"),
            cell: (p) => (
              <Box color={STATUS_TYPE[p.status] === "success" ? "text-status-success" : STATUS_TYPE[p.status] === "error" ? "text-status-error" : "text-status-info"}>
                {t(`admin.proposals.status.${p.status}` as Parameters<typeof t>[0]) || p.status}
              </Box>
            ),
          },
          {
            id: "actions",
            header: t("admin.proposals.columnActions"),
            cell: (p) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  loading={actingIds.has(p.id)}
                  onClick={() => {
                    void markContacted(p.id);
                  }}
                >
                  {t("admin.proposals.actionMarkContacted")}
                </Button>
                <Button
                  onClick={() => {
                    window.location.href =
                      `/create-meeting/index.html?proposalId=${p.id}&topic=${encodeURIComponent(p.topic)}&speakers=${encodeURIComponent(p.name)}&earliestDate=${p.earliestDate}`;
                  }}
                >
                  {t("admin.proposals.actionConvertToMeeting")}
                </Button>
              </SpaceBetween>
            ),
          },
        ]}
        filter={
          <Select
            selectedOption={
              STATUS_OPTIONS.find((o) => o.value === filter) ?? STATUS_OPTIONS[0]
            }
            onChange={({ detail }) => {
              setFilter(detail.selectedOption.value as Proposal["status"]);
            }}
            options={STATUS_OPTIONS}
            ariaLabel={t("admin.proposals.filterLabel")}
          />
        }
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="s">
              <Box variant="strong">{t("admin.proposals.emptyTitle")}</Box>
              <Box variant="p" color="inherit">
                {t("admin.proposals.emptySubtitle")}
              </Box>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header counter={loading ? undefined : `(${proposals.length})`}>
            {t("admin.proposals.tableHeader")}
          </Header>
        }
      />
    </SpaceBetween>
  );
}
