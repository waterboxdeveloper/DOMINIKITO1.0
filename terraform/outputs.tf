# Outputs for Dominikito GCP setup

output "cloud_run_service_account_email" {
  value       = module.service_accounts.cloud_run_sa_email
  description = "The email of the Cloud Run runtime service account."
}

output "agent_service_account_email" {
  value       = module.service_accounts.agent_sa_email
  description = "The email of the Agent Registry / Agent Runtime service account."
}

output "deployer_service_account_email" {
  value       = module.service_accounts.deploy_sa_email
  description = "The email of the CI/CD deployment service account."
}

output "staging_bucket_name" {
  value       = google_storage_bucket.staging_bucket.name
  description = "The name of the GCS bucket used for staging agent code."
}
