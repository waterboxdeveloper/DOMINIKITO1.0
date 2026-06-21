# Main Terraform configuration for Dominikito GCP setup

terraform {
  required_version = ">= 1.3.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Local list of APIs we need to enable in the main GCP project
locals {
  services = [
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "logging.googleapis.com",
    "cloudtrace.googleapis.com",
    "aiplatform.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com"
  ]
}

# Enable APIs in the GCP project
resource "google_project_service" "services" {
  for_each           = toset(local.services)
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# Obtain the Vertex AI service identity (needed for reasoning engines agent service account impersonation)
resource "google_project_service_identity" "vertex_ai_sa" {
  provider = google-beta
  project  = var.project_id
  service  = "aiplatform.googleapis.com"

  depends_on = [google_project_service.services]
}

# Create a GCS bucket for staging agent code deployment
resource "google_storage_bucket" "staging_bucket" {
  name                        = "${var.app_name}-staging-${var.project_id}"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.services]
}

# Call the custom service accounts module
module "service_accounts" {
  source = "./modules/service_accounts"

  project_id          = var.project_id
  firebase_project_id = var.firebase_project_id
  app_name            = var.app_name
  vertex_ai_sa_member = google_project_service_identity.vertex_ai_sa.member
  staging_bucket_name = google_storage_bucket.staging_bucket.name

  depends_on = [
    google_project_service.services,
    google_project_service_identity.vertex_ai_sa,
    google_storage_bucket.staging_bucket
  ]
}
