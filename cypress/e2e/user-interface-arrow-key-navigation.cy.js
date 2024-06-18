// set command
Cypress.Commands.add("closeWelcomePopup", () => {
  cy.get("#popup-notification--1__close-button").click();
});

describe("user interface arrow key navigation", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000");
    cy.closeWelcomePopup();
  });

  it("should be at singleplayer button when an arrow key is pressed for the first time (down arrow)", () => {
    cy.get("body").type("{downArrow}");
    cy.get("#main-menu-screen-button--singleplayer").should("have.class", "button--arrow-key-focused");
  });

  it("should be at singleplayer button when an arrow key is pressed for the first time (left arrow)", () => {
    cy.get("body").type("{leftArrow}");
    cy.get("#main-menu-screen-button--singleplayer").should("have.class", "button--arrow-key-focused");
  });

  it("should be at singleplayer button when an arrow key is pressed for the first time (up arrow)", () => {
    cy.get("body").type("{upArrow}");
    cy.get("#main-menu-screen-button--singleplayer").should("have.class", "button--arrow-key-focused");
  });

  it("should be at singleplayer button when an arrow key is pressed for the first time (right arrow)", () => {
    cy.get("body").type("{rightArrow}");
    cy.get("#main-menu-screen-button--singleplayer").should("have.class", "button--arrow-key-focused");
  });

  it("should be at singleplayer main menu when enter key is pressed on singleplayer button when focused", () => {
    cy.get("body").type("{downArrow}{enter}");
    cy.get("#main-content__singleplayer-menu-screen-container").should("not.have.css", "display", "none");
  });
});
