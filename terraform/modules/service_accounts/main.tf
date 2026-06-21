# Service Accounts and IAM Roles for Dominikito GCP setup

# 1. Cloud Run Runtime Service Account
resource "google_service_account" "run_sa" {
  account_id   = "${var.app_name}-run-sa"
  display_name = "Dominikito Cloud Run Service Account"
  project      = var.project_id
}

# Roles for Cloud Run Service Account in main GCP project
locals {
  run_sa_roles = [
    "roles/logging.logWriter",
    "roles/cloudtrace.agent",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor"
  ]
}

resource "google_project_iam_member" "run_sa_bindings" {
  for_each = toset(local.run_sa_roles)
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.run_sa.email}"
}

# 2. Agent Registry/Runtime Service Account
resource "google_service_account" "agent_sa" {
  account_id   = "${var.app_name}-agent-sa"
  display_name = "Dominikito Agent Runtime Service Account"
  project      = var.project_id
}

# Roles for Agent Service Account in main GCP project
locals {
  agent_sa_roles = [
    "roles/logging.logWriter",
    "roles/cloudtrace.agent",
    "roles/aiplatform.user",
    "roles/secretmanager.secretAccessor"
  ]
}

resource "google_project_iam_member" "agent_sa_bindings" {
  for_each = toset(local.agent_sa_roles)
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.agent_sa.email}"
}

# 3. CI/CD Deployment Service Account
resource "google_service_account" "deploy_sa" {
  account_id   = "${var.app_name}-deploy-sa"
  display_name = "Dominikito Deployment Service Account"
  project      = var.project_id
}

# Roles for Deployment Service Account in main GCP project
locals {
  deploy_sa_roles = [
    "roles/run.admin",
    "roles/aiplatform.admin",
    "roles/artifactregistry.admin",
    "roles/storage.admin",
    "roles/secretmanager.admin",
    "roles/iam.serviceAccountUser" # Can assign service accounts to resources at project level
  ]
}

resource "google_project_iam_member" "deploy_sa_bindings" {
  for_each = toset(local.deploy_sa_roles)
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# 4. Service Account User (Impersonation) bindings
# Allow the Deployer SA to act as the Cloud Run SA
resource "google_service_account_iam_member" "deploy_sa_impersonate_run_sa" {
  service_account_id = google_service_account.run_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Allow the Deployer SA to act as the Agent SA
resource "google_service_account_iam_member" "deploy_sa_impersonate_agent_sa" {
  service_account_id = google_service_account.agent_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy_sa.email}"
}

# Allow Vertex AI platform service identity to act as the Agent SA
resource "google_service_account_iam_member" "vertex_sa_impersonate_agent_sa" {
  service_account_id = google_service_account.agent_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = var.vertex_ai_sa_member
}

# Grant Vertex AI service identity standard agent runtime roles in the project
resource "google_project_iam_member" "vertex_ai_sa_agent_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/cloudtrace.agent"
  ])
  project  = var.project_id
  role     = each.key
  member   = var.vertex_ai_sa_member
}

# 5. GCS Bucket IAM bindings for agent deployments staging
resource "google_storage_bucket_iam_member" "deploy_sa_bucket_admin" {
  bucket = var.staging_bucket_name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.deploy_sa.email}"
}

resource "google_storage_bucket_iam_member" "agent_sa_bucket_reader" {
  bucket = var.staging_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.agent_sa.email}"
}
