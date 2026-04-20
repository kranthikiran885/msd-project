// Domain Service
const Domain = require("../models/Domain")
const { isValidUrl } = require("../utils/validators")

class DomainService {
  async createDomain(projectId, host) {
    const domain = new Domain({
      projectId,
      host,
      status: "pending",
      dnsRecords: [
        {
          type: "CNAME",
          host: host.split(".")[0],
          value: "cname.clouddeck.dev",
          ttl: 3600,
        },
      ],
    })

    await domain.save()
    return domain
  }

  async getDomains(projectId) {
    return await Domain.find({ projectId })
  }

  async getDomainById(id) {
    return await Domain.findById(id)
  }

  async updateDomain(id, data) {
    return await Domain.findByIdAndUpdate(id, data, { new: true })
  }

  async verifyDomain(id) {
    const domain = await Domain.findByIdAndUpdate(
      id,
      {
        status: "verified",
        "sslCertificate.issued": new Date(),
        "sslCertificate.expires": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        certificateStatus: "active",
      },
      { new: true },
    )
    return domain
  }

  async deleteDomain(id) {
    return await Domain.findByIdAndDelete(id)
  }

  // Phase 16 - Enhanced SSL & Auto-renewal
  async generateSSLCertificate(id) {
    const domain = await Domain.findById(id)
    if (!domain) throw new Error('Domain not found')

    domain.sslCertificate = {
      issued: new Date(),
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      provider: 'letsencrypt',
    }
    domain.certificateStatus = 'active'
    domain.renewalDate = new Date(Date.now() + 330 * 24 * 60 * 60 * 1000)
    domain.autoRenew = true
    await domain.save()
    return domain
  }

  async renewCertificate(id) {
    const domain = await Domain.findById(id)
    if (!domain) throw new Error('Domain not found')

    domain.certificateStatus = 'renewing'
    await domain.save()

    // Simulate renewal
    domain.sslCertificate.expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    domain.certificateStatus = 'active'
    domain.renewalDate = new Date(Date.now() + 330 * 24 * 60 * 60 * 1000)
    await domain.save()
    return domain
  }

  async setupAutoRenewal(id, enabled = true) {
    return await Domain.findByIdAndUpdate(
      id,
      { autoRenew: enabled, renewalDate: new Date(Date.now() + 330 * 24 * 60 * 60 * 1000) },
      { new: true }
    )
  }
}

module.exports = new DomainService()
