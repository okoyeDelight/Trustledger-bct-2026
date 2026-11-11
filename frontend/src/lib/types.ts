export interface TemperatureQuality {
  raw_rows: number;
  usable_rows: number;
  missing_temperature_or_timestamp_rows: number;
  known_sensor_glitch_rows: number;
  duplicate_rows: number;
  conflicting_duplicate_timestamps: number;
  estimated_missing_hourly_readings: number;
  out_of_range_readings: number;
  above_range_readings: number;
  below_range_readings: number;
}

export interface IncidentTrend {
  month: string;
  warning_count: number;
  sustained_count: number;
}

export interface FacilityMonitoring {
  facility_id: string;
  incident_count: number;
  sustained_count: number;
  latest_incident_at: string | null;
}

export interface DashboardData {
  site_name: string;
  country: string;
  temperature_policy: TemperaturePolicy;
  dataset_note: string;
  temperature_quality: TemperatureQuality;
  feature_evaluation: FeatureEvaluation;
  incident_count: number;
  sustained_incident_count: number;
  warning_episode_count: number;
  potentially_affected_unit_matches: number;
  unique_potentially_affected_units: number;
  incidents_with_power_outage_overlap: number;
  location_intervals_built: number;
  safety_note: string;
  incident_trends: IncidentTrend[];
  facility_monitoring: FacilityMonitoring[];
}

export interface TemperaturePolicy {
  minimum_c: number;
  maximum_c: number;
}

export interface SiteConfig {
  site_name: string;
  country: string;
  temperature_policy: TemperaturePolicy;
  identity_mode: string;
}

export interface EvaluationMetrics {
  candidate_units: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
  precision: number;
  recall: number;
}

export interface FeatureEvaluation {
  available: boolean;
  feature_name?: string;
  baseline_name?: string;
  population_units?: number;
  labeled_exposed_units?: number;
  feature?: EvaluationMetrics;
  baseline?: EvaluationMetrics;
  note: string;
}

export interface Incident {
  incident_id: string;
  facility_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  reading_count: number | null;
  peak_temp_c: number | null;
  minimum_temp_c: number | null;
  direction: string;
  severity: "warning" | "sustained" | string;
  sustained_rule: string;
  source_type?: "staff_report" | "temperature_csv" | "external_observation";
  source_system?: string | null;
  source_event_id?: string | null;
  source_payload?: Record<string, unknown> | null;
  report_title?: string;
  report_description?: string;
}

export interface AffectedUnit {
  incident_id: string;
  unit_id: string;
  facility_id: string;
  exposure_start: string;
  exposure_end: string;
  component: string;
  blood_group: string;
  unit_status: string;
}

export interface TemperaturePoint {
  recorded_at: string;
  temp_c: number | null;
  quality_status: "valid" | "known_sensor_glitch" | string;
}

export interface PowerCorrelation {
  incident_id: string;
  outage_id: string;
  backup_power_engaged: string | boolean;
  overlap_minutes: number;
}

export interface TransportAlert {
  transfer_id: string;
  unit_id: string;
  component: string;
  blood_group: string;
  unit_status: string;
  from_facility_id: string;
  to_facility_id: string;
  transfer_type: string;
  dispatched_at: string | null;
  received_at: string | null;
  transport_mode: string;
  coolbox_max_temp_c: number;
}

export interface IncidentDetail {
  incident: Incident;
  potentially_affected_units: AffectedUnit[];
  temperature_history: TemperaturePoint[];
  power_correlations: PowerCorrelation[];
  decision_required: boolean;
  notice: string;
  temperature_policy: TemperaturePolicy;
}

export type ReviewRole = "facility_staff" | "blood_service_supervisor";
export type ReviewDecision = "accept" | "change" | "reject";

export interface ReviewEvent {
  review_id: string;
  incident_id: string;
  actor_name: string;
  role: ReviewRole;
  decision: ReviewDecision;
  reason: string;
  changed_assessment: string | null;
  created_at: string;
  auth_method?: "preprovisioned_demo_account" | "legacy_self_reported";
  sync_status?: "pending_sync";
}

export interface AuthenticatedUser {
  username: string;
  actor_name: string;
  role: ReviewRole;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  notice?: string;
}

export type DataQuality = TemperatureQuality;

export interface StaffReportRequest {
  facility_code: string;
  category: "equipment_problem" | "monitoring_gap" | "temperature_excursion" | "sensor_anomaly" | "other";
  title: string;
  description: string;
  observed_at: string;
}

export interface InvestigationNote {
  note_id: string;
  case_reference: string;
  actor_name: string;
  actor_role: ReviewRole;
  finding: string;
  created_at: string;
}

export type CaseState = "investigating" | "awaiting_review" | "returned" | "followup" | "closed";
export interface CaseEvent {
  id: number;
  case_reference: string;
  event_kind: string;
  actor_username: string;
  actor_name: string;
  actor_role: ReviewRole;
  details: Record<string, unknown>;
  created_at: string;
}
export interface CaseFollowup {
  action_id: string;
  description: string;
  owner_username: string;
  due_at: string | null;
  status: "open" | "done";
  created_at: string;
  completed_at: string | null;
  completion_note: string | null;
}
export interface CaseWorkflow {
  case_reference: string;
  status: CaseState;
  submitted_by: string | null;
  followups: CaseFollowup[];
  events: CaseEvent[];
}
export interface PendingCaseReview {
  case_reference: string;
  submitted_by: string;
  submitted_at: string;
}
