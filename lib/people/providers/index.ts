import { edgarProvider } from "./edgar";
import { emailPatternProvider } from "./email-pattern";
import { githubProvider } from "./github";
import type { PeopleProvider } from "./types";
import { websiteProvider } from "./website";

/**
 * The providers a discovery run uses, in order. Order matters: later
 * providers see what earlier ones found. The email pattern learns from the
 * addresses the website and registry providers read, so it runs last.
 *
 * To add one, write a module that implements `PeopleProvider` and put it in
 * this list (README: "Decision-makers: adding a provider").
 */
export const PROVIDERS: PeopleProvider[] = [websiteProvider, edgarProvider, githubProvider, emailPatternProvider];
