import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { SecurityEventService } from "@/modules/auth/security-event.service.js";

import type { PreparedUploadFile, UploadContext } from "../media.service.js";
import { MediaThreatService } from "../media.threats.js";
import type { MediaThreatServiceOptions } from "../media.threats.js";

describe("MediaThreatService", () => {
  const file: PreparedUploadFile = {
    fieldName: "files",
    originalName: "virus.png",
    mimeType: "image/png",
    size: 512,
    buffer: Buffer.from("malware"),
  };

  const context: UploadContext = {
    folder: "lumi/products",
    tags: [],
    visibility: "public",
    metadata: undefined,
    uploadedById: "user_123",
    ipAddress: "127.0.0.1",
    userAgent: "jest",
  };

  const securityEvents = {
    log: jest.fn(async () => {}),
  };

  const typedSecurityEvents = securityEvents as unknown as SecurityEventService;

  type FileSystem = NonNullable<MediaThreatServiceOptions["fileSystem"]>;

  const mkdirMock = jest.fn(async () => undefined as string | undefined);
  const writeFileMock = jest.fn(async () => {});

  const fileSystem: FileSystem = {
    mkdir: mkdirMock as FileSystem["mkdir"],
    writeFile: writeFileMock as FileSystem["writeFile"],
  };

  beforeEach(() => {
    mkdirMock.mockClear();
    writeFileMock.mockClear();
    securityEvents.log.mockClear();
  });

  it("writes quarantined files and emits security events", async () => {
    const service = new MediaThreatService({
      quarantineDir: "/tmp/quarantine",
      securityEvents: typedSecurityEvents,
      fileSystem,
    });

    const result = await service.quarantineUpload(file, context, "malware", { code: "MALWARE" });

    expect(mkdirMock).toHaveBeenCalledWith("/tmp/quarantine", { recursive: true });
    expect(writeFileMock).toHaveBeenCalled();
    expect(securityEvents.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "media_upload_malware_detected",
        userId: "user_123",
      }),
    );
    expect(result?.storedAt).toContain("/tmp/quarantine");
  });
});
