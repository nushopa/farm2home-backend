jest.mock("../models/Notification", () => ({
  find: jest.fn(),
}));
jest.mock("../lib/util/optionalAuth", () => ({
  getOptionalUser: jest.fn(),
}));

const Notification = require("../models/Notification");
const { getOptionalUser } = require("../lib/util/optionalAuth");
const {
  getDriverNotifications,
} = require("../controllers/notification.controller");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe("getDriverNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects requests without the matching authenticated driver", async () => {
    getOptionalUser.mockResolvedValue({
      userId: "another-driver",
      userModel: "Drivers",
    });
    const response = createResponse();

    await getDriverNotifications(
      { params: { driverId: "driver-1" } },
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(Notification.find).not.toHaveBeenCalled();
  });

  it("returns only the authenticated driver's notifications", async () => {
    const records = [{ _id: "notification-1" }];
    getOptionalUser.mockResolvedValue({
      userId: "driver-1",
      userModel: "Drivers",
    });
    Notification.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(records),
    });
    const response = createResponse();

    await getDriverNotifications(
      { params: { driverId: "driver-1" } },
      response,
    );

    expect(Notification.find).toHaveBeenCalledWith({
      recipient_id: "driver-1",
      recipient_model: "Drivers",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(records);
  });
});
