import { LogViewer } from "@/components/LogViewer";
import { TokenRefresher } from "@/components/TokenRefresher";
import { loadLogsPage, type RawSearch } from "@/lib/logs-page";

export const dynamic = "force-dynamic";

export default async function ServiceLogs({
  params,
  searchParams,
}: {
  params: Promise<{ service: string }>;
  searchParams: Promise<RawSearch>;
}) {
  const [{ service: rawService }, sp] = await Promise.all([params, searchParams]);
  const service = decodeURIComponent(rawService);
  const data = await loadLogsPage(sp);

  const logs = data.logs.filter((l) => l.service === service);

  return (
    <>
      <TokenRefresher />
      <LogViewer
        logs={logs}
        error={data.error}
        pagination={data.pagination}
        appliedLimit={data.appliedLimit}
        appliedStartDate={data.appliedStartDate}
        appliedEndDate={data.appliedEndDate}
        env={data.session.env}
        apiBase={data.session.apiBase}
        allServices={data.allServices}
        serviceCounts={data.serviceCounts}
        activeService={service}
      />
    </>
  );
}
