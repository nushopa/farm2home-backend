jest.mock("../models/Customer", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../lib/util/onboarding", () => ({
  sendWelcomeEmail: jest.fn(),
}));
jest.mock("passport", () => ({
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn().mockImplementation(function (_options, verify) {
    this.verify = verify;
  }),
}));

const Customer = require("../models/Customer");
const { sendWelcomeEmail } = require("../lib/util/onboarding");
const passport = require("../config/passport");
const googleStrategy = passport.use.mock.calls[0][0];

describe("Google customer registration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sends a personalized welcome email when a new customer is created", async () => {
    const newCustomer = {
      email: "customer@example.com",
      first_name: "Ava",
      role: 2001,
    };
    const profile = {
      id: "google-user-1",
      emails: [{ value: newCustomer.email, verified: true }],
      name: { givenName: newCustomer.first_name, familyName: "One" },
      photos: [],
    };
    Customer.findOne.mockResolvedValue(null);
    Customer.create.mockResolvedValue(newCustomer);
    sendWelcomeEmail.mockResolvedValue();

    const customer = await new Promise((resolve, reject) => {
      googleStrategy.verify("access-token", null, profile, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });

    expect(customer).toBe(newCustomer);
    expect(sendWelcomeEmail).toHaveBeenCalledWith("customer", {
      email: newCustomer.email,
      firstName: newCustomer.first_name,
    });
  });

  test("does not resend a welcome email when an existing customer signs in", async () => {
    const existingCustomer = {
      email: "customer@example.com",
      save: jest.fn(),
    };
    const profile = {
      id: "google-user-1",
      emails: [{ value: existingCustomer.email, verified: true }],
      photos: [],
    };
    Customer.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingCustomer);

    const customer = await new Promise((resolve, reject) => {
      googleStrategy.verify("access-token", null, profile, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });

    expect(customer).toBe(existingCustomer);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });
});
