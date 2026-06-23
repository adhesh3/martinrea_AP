| Bug                                                                                 | Fix Implemented                                                                                                            |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The transaction goes for approval despite not being **Matched**.                    | Added validation to ensure only **Matched** transactions are eligible for the approval workflow.                           |
| The file goes for approval to the Finance Director even when it is **Not Matched**. | Updated approval logic to prevent **Not Matched** files from being forwarded to the Finance Director.                      |
| No dedicated page to view transactions ready for submission.                        | Created a **Ready to Submit** page displaying all transactions with **Matched** status.                                    |
| Multiple discrepancies existed in the approval workflow.                            | Resolved all identified approval workflow discrepancies and improved process consistency.                                  |
| Incorrect **Pending with Other Approval** error occurred.                           | Fixed the issue causing the incorrect **Pending with Other Approval** status.                                              |
| Rejection reason was not visible to the clerk after transaction rejection.          | Implemented functionality to display the rejection reason to the clerk whenever a transaction is rejected by an authority. |

## Completed Enhancements

* Added validation for transaction approval eligibility.
* Restricted approval routing for unmatched transactions.
* Introduced a **Ready to Submit** page.
* Improved approval workflow consistency.
* Fixed approval status handling issues.
* Added rejection reason visibility for clerks.


