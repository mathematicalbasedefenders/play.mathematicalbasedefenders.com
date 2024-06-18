// set command
Cypress.Commands.add("closeWelcomePopup", () => {
  cy.get("#popup-notification--1__close-button").click();
});

Cypress.Commands.add("goToLogInField", () => {
  cy.get("#main-menu-screen-button--settings").click();
  cy.get("#settings-screen__sidebar-item--online").click();
});

describe("authentication", () => {
  // set authentication route
  beforeEach(() => {
    cy.visit("http://localhost:3000");
    cy.intercept("POST", "/authenticate").as("postAuthentication");
    cy.closeWelcomePopup();
    cy.goToLogInField();
  });

  it("should allow logging users in w/ correct credentials", () => {
    cy.get("#settings-screen__content--online__username").type("mistertfy64water");
    // password in testing db should be changed to this
    cy.get("#settings-screen__content--online__password").type("password-mistertfy64water");
    cy.get("#settings-screen__content--online__submit").click();
    cy.wait("@postAuthentication");
    cy.get("#user-account-stat--username").should("have.text", "mistertfy64water");
  });

  it("should not allow logging users in w/ incorrect credentials", () => {
    cy.get("#settings-screen__content--online__username").type("mistertfy64water");
    cy.get("#settings-screen__content--online__password").type("password-mistertfy64water-incorrect");
    cy.get("#settings-screen__content--online__submit").click();
    cy.wait("@postAuthentication");
    cy.get("#user-account-stat--username").should("not.have.text", "mistertfy64water");
  });

  it("should not allow logging users in w/ invalid credentials", () => {
    cy.get("#settings-screen__content--online__username").type("<script>alert(1)</script>");
    cy.get("#settings-screen__content--online__password").type("password-mistertfy64water");
    cy.get("#settings-screen__content--online__submit").click();
    cy.wait("@postAuthentication");
    cy.get("#user-account-stat--username").should("not.have.text", "mistertfy64water");
  });
});
