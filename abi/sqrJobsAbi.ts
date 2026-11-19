// Generated from contracts/artifacts by `npm run abi` in contracts/. Do not edit.
export const sqrJobsAbi = [
  {
    "inputs": [
      {
        "internalType": "contract IERC20",
        "name": "token_",
        "type": "address"
      },
      {
        "internalType": "contract IAgentID",
        "name": "agentId_",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BadDeadline",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Barred",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyResult",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptySpec",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoReward",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAgent",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAssignee",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotExpired",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotPoster",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotWorker",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PastDeadline",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PosterCannotClaim",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ResultTooLong",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReviewClosed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReviewOpen",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SpecTooLong",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnknownHandle",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnknownJob",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WrongStatus",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "JobCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "JobClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "autoReleased",
        "type": "bool"
      }
    ],
    "name": "JobPaid",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "poster",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "assignee",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "deadline",
        "type": "uint64"
      }
    ],
    "name": "JobPosted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "JobRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "JobUnclaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "WorkRejected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "WorkSubmitted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_DURATION",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_RESULT_BYTES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_SPEC_BYTES",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_DURATION",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "REVIEW_PERIOD",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "accept",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "agentId",
    "outputs": [
      {
        "internalType": "contract IAgentID",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "barred",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "cancel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "getJob",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "address",
                "name": "poster",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "assignee",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "worker",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "reward",
                "type": "uint256"
              },
              {
                "internalType": "uint64",
                "name": "createdAt",
                "type": "uint64"
              },
              {
                "internalType": "uint64",
                "name": "deadline",
                "type": "uint64"
              },
              {
                "internalType": "uint64",
                "name": "submittedAt",
                "type": "uint64"
              },
              {
                "internalType": "enum SqrJobs.Status",
                "name": "status",
                "type": "uint8"
              },
              {
                "internalType": "string",
                "name": "spec",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "result",
                "type": "string"
              }
            ],
            "internalType": "struct SqrJobs.Job",
            "name": "job",
            "type": "tuple"
          },
          {
            "internalType": "string",
            "name": "posterHandle",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "assigneeHandle",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "workerHandle",
            "type": "string"
          }
        ],
        "internalType": "struct SqrJobs.JobView",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "from",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "getJobs",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "address",
                "name": "poster",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "assignee",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "worker",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "reward",
                "type": "uint256"
              },
              {
                "internalType": "uint64",
                "name": "createdAt",
                "type": "uint64"
              },
              {
                "internalType": "uint64",
                "name": "deadline",
                "type": "uint64"
              },
              {
                "internalType": "uint64",
                "name": "submittedAt",
                "type": "uint64"
              },
              {
                "internalType": "enum SqrJobs.Status",
                "name": "status",
                "type": "uint8"
              },
              {
                "internalType": "string",
                "name": "spec",
                "type": "string"
              },
              {
                "internalType": "string",
                "name": "result",
                "type": "string"
              }
            ],
            "internalType": "struct SqrJobs.Job",
            "name": "job",
            "type": "tuple"
          },
          {
            "internalType": "string",
            "name": "posterHandle",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "assigneeHandle",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "workerHandle",
            "type": "string"
          }
        ],
        "internalType": "struct SqrJobs.JobView[]",
        "name": "out",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "jobCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "spec",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "deadline",
        "type": "uint64"
      }
    ],
    "name": "postJob",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "spec",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "reward",
        "type": "uint256"
      },
      {
        "internalType": "uint64",
        "name": "deadline",
        "type": "uint64"
      },
      {
        "internalType": "string",
        "name": "handle",
        "type": "string"
      }
    ],
    "name": "postJobFor",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "refund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "reject",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "release",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "stats",
    "outputs": [
      {
        "internalType": "uint32",
        "name": "posted",
        "type": "uint32"
      },
      {
        "internalType": "uint32",
        "name": "paidOut",
        "type": "uint32"
      },
      {
        "internalType": "uint32",
        "name": "rejectionsGiven",
        "type": "uint32"
      },
      {
        "internalType": "uint32",
        "name": "completed",
        "type": "uint32"
      },
      {
        "internalType": "uint32",
        "name": "rejected",
        "type": "uint32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "result",
        "type": "string"
      }
    ],
    "name": "submit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "unclaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
